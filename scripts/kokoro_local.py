#!/usr/bin/env python3
"""Speak Manifester's known phrases with Kokoro-82M, with no server anywhere.

    npm run speech:local

`generate-speech.mjs` owns the interesting decisions — which phrases, which
voices, what each clip is called — and hands this script a plan. This script
owns exactly one thing: turning a line of text into the same audio Kokoro would
produce in the browser, and writing it where the plan says.

Why a second implementation at all, when `server/kokoro.mjs` already talks to
Kokoro-FastAPI: because the clips that ship with the app should be buildable
from a checkout and a network connection, without Docker, a GPU, or a running
container. That is what makes `public/speech` reproducible by anybody who wants
to check it rather than a binary drop nobody can regenerate.

The front end here is a direct port of `kokoro.js/src/phonemize.js`, on purpose.
The browser's Studio Voice runs that exact file, so a clip generated here and
the same sentence synthesised live on somebody's phone go through the same
normalisation, the same espeak call and the same post-processing — which is the
only way "pre-generated" and "generated on this device" can be the same voice
rather than two similar ones.

Requirements (installed on demand into `.cache/kokoro/venv` by the npm script):

    onnxruntime numpy soundfile espeakng-loader phonemizer-fork
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

import numpy as np
import onnxruntime as ort
import soundfile as sf

import espeakng_loader
from phonemizer.backend import EspeakBackend
from phonemizer.backend.espeak.wrapper import EspeakWrapper

EspeakWrapper.set_library(espeakng_loader.get_library_path())
EspeakWrapper.set_data_path(espeakng_loader.get_data_path())

REPO_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = Path(os.environ.get("KOKORO_CACHE_DIR", REPO_ROOT / ".cache" / "kokoro"))

# The ONNX export of hexgrad/Kokoro-82M v1.0 and its 54 voice style vectors.
# Byte-identical to the `voices/*.bin` files kokoro-js ships, which is checked
# by `--self-test`.
RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
MODEL_FILES = {
    "kokoro-v1.0.onnx": f"{RELEASE}/kokoro-v1.0.onnx",
    "voices-v1.0.bin": f"{RELEASE}/voices-v1.0.bin",
}

SAMPLE_RATE = 24_000
STYLE_DIM = 256
MAX_TOKENS = 510


# ── espeak-ng ────────────────────────────────────────────────────────────────

_BACKENDS: dict[str, EspeakBackend] = {}


def _backend(language: str) -> EspeakBackend:
    if language not in _BACKENDS:
        _BACKENDS[language] = EspeakBackend(
            language=language,
            preserve_punctuation=False,
            with_stress=True,
        )
    return _BACKENDS[language]


# ── the vocabulary ───────────────────────────────────────────────────────────


def _build_symbols() -> list[str]:
    """Kokoro's 178 symbols, in the order the checkpoint was trained on.

    Not a choice: the text encoder's embedding table has exactly 178 rows and
    row *n* is whatever symbol sat at index *n* during training, so this
    ordering is part of the weights. Getting it wrong does not raise anything —
    it produces fluent, confident nonsense.

    Inherited from StyleTTS2, including the apostrophe that appears twice in
    the IPA run. Both occurrences take a row of the embedding table, so the
    list has 178 entries while the lookup below has 177 keys — dropping the
    repeat to make those agree would shift every symbol after it by one and
    silently re-map the second half of the alphabet.
    """
    pad = "$"
    punctuation = ';:,.!?¡¿—…"«»“” '
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    letters_ipa = (
        "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊ"
        "ʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ"
    )
    return [pad, *punctuation, *letters, *letters_ipa]


SYMBOLS = _build_symbols()

# Later wins, exactly as StyleTTS2 builds it: the repeated apostrophe resolves
# to its second row and the first is simply never addressed.
VOCAB = {symbol: index for index, symbol in enumerate(SYMBOLS)}


# ── text normalisation (port of kokoro.js/src/phonemize.js) ──────────────────


def _split_num(match: re.Match[str]) -> str:
    text = match.group(0)
    if "." in text:
        return text
    if ":" in text:
        hours, minutes = (int(part) for part in text.split(":"))
        if minutes == 0:
            return f"{hours} o'clock"
        if minutes < 10:
            return f"{hours} oh {minutes}"
        return f"{hours} {minutes}"
    year = int(text[:4])
    if year < 1100 or year % 1000 < 10:
        return text
    left, right = text[:2], int(text[2:4])
    suffix = "s" if text.endswith("s") else ""
    if 100 <= year % 1000 <= 999:
        if right == 0:
            return f"{left} hundred{suffix}"
        if right < 10:
            return f"{left} oh {right}{suffix}"
    return f"{left} {right}{suffix}"


def _flip_money(match: re.Match[str]) -> str:
    text = match.group(0)
    bill = "dollar" if text[0] == "$" else "pound"
    rest = text[1:]
    try:
        float(rest)
    except ValueError:
        return f"{rest} {bill}s"
    if "." not in text:
        return f"{rest} {bill}{'' if rest == '1' else 's'}"
    whole, fraction = rest.split(".")
    pennies = int(fraction.ljust(2, "0")[:2])
    if text[0] == "$":
        coins = "cent" if pennies == 1 else "cents"
    else:
        coins = "penny" if pennies == 1 else "pence"
    return f"{whole} {bill}{'' if whole == '1' else 's'} and {pennies} {coins}"


def _point_num(match: re.Match[str]) -> str:
    whole, fraction = match.group(0).split(".")
    return f"{whole} point {' '.join(fraction)}"


def normalize_text(text: str) -> str:
    text = re.sub(r"[‘’]", "'", text)
    text = text.replace("«", "“").replace("»", "”")
    text = re.sub(r"[“”]", '"', text)
    text = text.replace("(", "«").replace(")", "»")
    for source, target in (
        ("、", ", "), ("。", ". "), ("！", "! "), ("，", ", "),
        ("：", ": "), ("；", "; "), ("？", "? "),
    ):
        text = text.replace(source, target)
    text = re.sub(r"[^\S \n]", " ", text)
    text = re.sub(r"  +", " ", text, count=1)
    text = re.sub(r"(?<=\n) +(?=\n)", "", text)
    text = re.sub(r"\bD[Rr]\.(?= [A-Z])", "Doctor", text)
    text = re.sub(r"\b(?:Mr\.|MR\.(?= [A-Z]))", "Mister", text)
    text = re.sub(r"\b(?:Ms\.|MS\.(?= [A-Z]))", "Miss", text)
    text = re.sub(r"\b(?:Mrs\.|MRS\.(?= [A-Z]))", "Mrs", text)
    text = re.sub(r"\betc\.(?! [A-Z])", "etc", text, flags=re.IGNORECASE)
    text = re.sub(r"\b(y)eah?\b", r"\1e'a", text, flags=re.IGNORECASE)
    text = re.sub(
        r"\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)",
        _split_num,
        text,
    )
    text = re.sub(r"(?<=\d),(?=\d)", "", text)
    text = re.sub(
        r"[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b"
        r"|[$£]\d+\.\d\d?\b",
        _flip_money,
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(r"\d*\.\d+", _point_num, text)
    text = re.sub(r"(?<=\d)-(?=\d)", " to ", text)
    text = re.sub(r"(?<=\d)S", " S", text)
    text = re.sub(r"(?<=[BCDFGHJ-NP-TV-Z])'?s\b", "'S", text)
    text = re.sub(r"(?<=X')S\b", "s", text)
    text = re.sub(
        r"(?:[A-Za-z]\.){2,} [a-z]",
        lambda m: m.group(0).replace(".", "-"),
        text,
    )
    text = re.sub(r"(?<=[A-Z])\.(?=[A-Z])", "-", text, flags=re.IGNORECASE)
    return text.strip()


PUNCTUATION = ';:,.!?¡¿—…"«»“”(){}[]'
PUNCTUATION_PATTERN = re.compile(rf"(\s*[{re.escape(PUNCTUATION)}]+\s*)+")


def _split_keeping_delimiters(text: str, pattern: re.Pattern[str]):
    parts: list[tuple[bool, str]] = []
    previous = 0
    for match in pattern.finditer(text):
        if previous < match.start():
            parts.append((False, text[previous : match.start()]))
        if match.group(0):
            parts.append((True, match.group(0)))
        previous = match.end()
    if previous < len(text):
        parts.append((False, text[previous:]))
    return parts


def phonemize(text: str, language: str = "a") -> str:
    """Text to IPA, exactly as kokoro-js does it.

    Punctuation is carried through untouched rather than handed to espeak,
    because Kokoro is trained to read `,` and `.` as timing: they are tokens in
    the vocabulary above, and losing them loses every pause in the sentence.
    """
    text = normalize_text(text)
    espeak_language = "en-us" if language == "a" else "en-gb"
    pieces: list[str] = []
    for is_punctuation, chunk in _split_keeping_delimiters(text, PUNCTUATION_PATTERN):
        if is_punctuation:
            pieces.append(chunk)
        else:
            pieces.append(" ".join(_backend(espeak_language).phonemize([chunk], strip=True)))

    phonemes = "".join(pieces)
    phonemes = phonemes.replace("kəkˈoːɹoʊ", "kˈoʊkəɹoʊ")
    phonemes = phonemes.replace("kəkˈɔːɹəʊ", "kˈəʊkəɹəʊ")
    phonemes = (
        phonemes.replace("ʲ", "j").replace("r", "ɹ").replace("x", "k").replace("ɬ", "l")
    )
    phonemes = re.sub(r"(?<=[a-zɹː])(?=hˈʌndɹɪd)", " ", phonemes)
    phonemes = re.sub(r" z(?=[;:,.!?¡¿—…\"«»“” ]|$)", "z", phonemes)
    if language == "a":
        phonemes = re.sub(r"(?<=nˈaɪn)ti(?!ː)", "di", phonemes)
    return phonemes.strip()


# ── the model ────────────────────────────────────────────────────────────────


def _download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_suffix(destination.suffix + ".part")
    print(f"  downloading {destination.name} …", flush=True)
    with urllib.request.urlopen(url) as response, partial.open("wb") as handle:
        total = int(response.headers.get("content-length") or 0)
        read = 0
        while True:
            chunk = response.read(1 << 20)
            if not chunk:
                break
            handle.write(chunk)
            read += len(chunk)
            if total:
                sys.stdout.write(f"\r    {read * 100 // total}%")
                sys.stdout.flush()
    if total:
        sys.stdout.write("\r    100%\n")
    partial.replace(destination)


def ensure_model() -> tuple[Path, Path]:
    paths = {}
    for name, url in MODEL_FILES.items():
        path = CACHE_DIR / name
        if not path.exists() or path.stat().st_size == 0:
            _download(url, path)
        paths[name] = path
    return paths["kokoro-v1.0.onnx"], paths["voices-v1.0.bin"]


class Kokoro:
    def __init__(self, model_path: Path, voices_path: Path) -> None:
        options = ort.SessionOptions()
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        options.intra_op_num_threads = max(1, os.cpu_count() or 1)
        self.session = ort.InferenceSession(
            str(model_path), options, providers=["CPUExecutionProvider"]
        )
        self.voices = np.load(voices_path)

    def generate(self, text: str, voice: str, speed: float, language: str = "a"):
        phonemes = phonemize(text, language)
        ids = [VOCAB[symbol] for symbol in phonemes if symbol in VOCAB][:MAX_TOKENS]
        tokens = np.array([[0, *ids, 0]], dtype=np.int64)

        # kokoro-js picks the style row by token count, clamped to the pack's
        # 510 rows. Matching it exactly is what keeps a pre-generated clip and
        # a locally generated one the same performance rather than two takes.
        row = min(max(tokens.shape[1] - 2, 0), self.voices[voice].shape[0] - 1)
        style = self.voices[voice][row].reshape(1, STYLE_DIM).astype(np.float32)

        audio = self.session.run(
            None,
            {
                "tokens": tokens,
                "style": style,
                "speed": np.array([speed], dtype=np.float32),
            },
        )[0]
        return np.asarray(audio, dtype=np.float32).reshape(-1), phonemes


def trim(audio: np.ndarray, threshold: float = 2e-3, pad_ms: int = 60) -> np.ndarray:
    """Drop dead air at both ends, keeping a breath of padding.

    Kokoro leaves a variable amount of silence around an utterance, and in a
    loop that silence is heard as an unsteady gap between repetitions. The
    padding that stays is deliberate: cutting to the first loud sample clips
    the attack of a plosive, which is audible as a click.
    """
    loud = np.nonzero(np.abs(audio) > threshold)[0]
    if loud.size == 0:
        return audio
    pad = int(SAMPLE_RATE * pad_ms / 1000)
    start = max(0, int(loud[0]) - pad)
    end = min(audio.size, int(loud[-1]) + pad)
    return audio[start:end]


def encode(audio: np.ndarray, fmt: str) -> bytes:
    buffer = io.BytesIO()
    if fmt == "mp3":
        sf.write(buffer, audio, SAMPLE_RATE, format="MP3", subtype="MPEG_LAYER_III")
    elif fmt == "opus":
        sf.write(buffer, audio, SAMPLE_RATE, format="OGG", subtype="OPUS")
    elif fmt == "wav":
        sf.write(buffer, audio, SAMPLE_RATE, format="WAV", subtype="PCM_16")
    else:
        raise ValueError(f"Unknown format: {fmt}")
    return buffer.getvalue()


# ── the plan ─────────────────────────────────────────────────────────────────


def run_plan(plan_path: Path) -> int:
    plan = json.loads(plan_path.read_text("utf-8"))
    jobs = plan["jobs"]
    output_dir = Path(plan["outputDir"])

    if not jobs:
        print("Nothing to generate; every clip is already present.")
        return 0

    model_path, voices_path = ensure_model()
    print(f"Loading {model_path.name} …", flush=True)
    model = Kokoro(model_path, voices_path)

    # One synthesis per (text, voice, speed); the formats are two encodings of
    # the same performance and must not be two takes of it.
    grouped: dict[tuple[str, str, float], list[dict]] = {}
    for job in jobs:
        grouped.setdefault((job["spoken"], job["engineVoice"], job["speed"]), []).append(job)

    made = 0
    failed = 0
    for index, ((spoken, voice, speed), members) in enumerate(grouped.items(), start=1):
        try:
            audio, _ = model.generate(spoken, voice, speed)
            audio = trim(audio)
            if audio.size < SAMPLE_RATE // 10:
                raise RuntimeError("synthesis produced almost no audio")
            for job in members:
                data = encode(audio, job["format"])
                target = output_dir / job["relative"]
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
                made += 1
        except Exception as error:  # noqa: BLE001 — one bad line must not stop the run
            failed += len(members)
            print(f"\n  ! {voice} {speed}× — {spoken[:60]!r}: {error}", flush=True)
        if index % 10 == 0 or index == len(grouped):
            print(f"  {index}/{len(grouped)} phrases", flush=True)

    print(f"{made} file(s) written, {failed} failed.")
    return 1 if failed and not made else 0


def self_test() -> int:
    """Prove the front end and the vocabulary are still the right ones."""
    checks = [
        ("This is how your words will sound.", "ðɪs ɪz hˌaʊ jʊɹ wˈɜːdz wɪl sˈaʊnd."),
        ("I am enough, exactly as I am today.", "aɪɐm ɪnˈʌf, ɛɡzˈæktli æz aɪɐm tədˈeɪ."),
    ]
    ok = True
    for text, expected in checks:
        actual = phonemize(text)
        if actual != expected:
            print(f"  phonemes changed for {text!r}\n    want {expected!r}\n    got  {actual!r}")
            ok = False
    if len(SYMBOLS) != 178:
        print(f"  vocabulary is {len(SYMBOLS)} symbols, expected 178")
        ok = False

    model_path, voices_path = ensure_model()
    model = Kokoro(model_path, voices_path)
    audio, _ = model.generate("This is how your words will sound.", "af_heart", 1.0)
    audio = trim(audio)
    seconds = audio.size / SAMPLE_RATE
    peak = float(np.max(np.abs(audio)))
    if not 1.0 < seconds < 3.0:
        print(f"  clip is {seconds:.2f}s, expected roughly 1.5s")
        ok = False
    if not 0.1 < peak < 1.0:
        print(f"  peak is {peak:.3f}, expected an ordinary speech level")
        ok = False
    print("self-test:", "ok" if ok else "FAILED")
    return 0 if ok else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plan", nargs="?", help="JSON plan written by generate-speech.mjs")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--say", help="Synthesise one line to a WAV file and exit")
    parser.add_argument("--voice", default="af_heart")
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--out", default="kokoro-sample.wav")
    args = parser.parse_args()

    if args.self_test:
        return self_test()

    if args.say:
        model = Kokoro(*ensure_model())
        audio, phonemes = model.generate(args.say, args.voice, args.speed)
        Path(args.out).write_bytes(encode(trim(audio), "wav"))
        print(f"{phonemes}\n→ {args.out}")
        return 0

    if not args.plan:
        parser.error("a plan file is required (or use --self-test / --say)")
    return run_plan(Path(args.plan))


if __name__ == "__main__":
    raise SystemExit(main())
