/**
 * One piece of music, repeating indefinitely, with nothing at the join.
 *
 * ── Why this is not `source.loop = true` ──
 *
 * The obvious spelling is four characters long and wrong for these files in
 * three separate ways:
 *
 *  1. **MP3 padding.** A decoder returns a few tens of milliseconds of digital
 *     silence before the first sample the composer wrote, because the format
 *     is framed and the encoder had to fill the first frame. Looping the
 *     buffer whole puts that silence *inside* the piece, once a minute. That
 *     is the gap everybody means by "MP3 loops don't work".
 *  2. **A composed ending.** Every one of these pieces winds down and fades
 *     out. Playing it and cutting back to a full-level opening is a restart
 *     you can hear from the next room.
 *  3. **The join itself.** Even between two well-matched points, splicing one
 *     waveform onto another mid-cycle is a step, and a step is a click.
 *
 * ── What happens instead ──
 *
 * The repeating region is `[start, start + loopSeconds)`, where `start` is the
 * first sample above silence — measured here, because decoders disagree about
 * the padding by a frame or so — and `loopSeconds` was measured off the file
 * to stop before the ending. Each repetition is its own buffer source with its
 * own gain, and consecutive repetitions overlap by `SEAM_SECONDS`:
 *
 *     rep n      ──────────────────────────╲___
 *     rep n+1                            ___╱──────────────────────────
 *                                          └ SEAM_SECONDS ┘
 *
 * The outgoing side follows a cosine down, the incoming side a sine up, and
 * because sin² + cos² is one, the sum holds level exactly across the join —
 * which is what a linear crossfade does not do, and why the middle of a naïve
 * one sags by 3 dB. The overlap is 1.2 seconds against pieces one to three
 * minutes long: long enough that no spectral mismatch survives it, short
 * enough that it is not a musical event.
 *
 * ── Scheduling ──
 *
 * Repetitions are laid down `HORIZON_SECONDS` ahead by `tick()`, which the
 * manager calls on the app's heartbeat rather than on a timer: a browser will
 * clamp `setTimeout` in a hidden tab to one second and eventually to one
 * minute, and a repetition scheduled a minute late is a minute of silence. The
 * heartbeat is driven partly by the audio clock, which nothing throttles. See
 * `heartbeat.ts`.
 *
 * The subscription lives in the manager rather than in here so that one
 * heartbeat listener serves however many voices are sounding, and so that a
 * voice can be driven a step at a time by an offline render — which is how the
 * seam below is measured rather than asserted.
 *
 * Everything is scheduled in absolute context time, so an interruption that
 * suspends the context does not desynchronise anything: `currentTime` stops,
 * the scheduled moments stop arriving, and both start again together.
 */

import { scheduleFade } from '../audioParams'

/**
 * The overlap around the join.
 *
 * Must match `OVERLAP` in `scripts/music-loop-points.mjs`, which chooses each
 * piece's loop point by matching the loudness of exactly this much material on
 * either side of it.
 */
export const SEAM_SECONDS = 1.2

/** How far ahead repetitions are scheduled. */
const HORIZON_SECONDS = 4

/** Anything below this is silence rather than a very quiet note. */
const SILENCE = 1e-4

/**
 * How far into a file the search for the first real sample gives up.
 *
 * Encoder padding is measured in tens of milliseconds. A whole second is
 * generous by a factor of thirty and still cheap; past it, the file is not
 * padded, it simply begins quietly, and trimming further would cut music.
 */
const LEAD_IN_SEARCH_SECONDS = 1

export interface LoopRegion {
  /** Seconds into the buffer where the repeating region starts. */
  offsetSeconds: number
  /** How long the region is. */
  lengthSeconds: number
  /** How long one repetition lasts, once the overlap is taken off. */
  periodSeconds: number
  /** The overlap actually used, which a very short buffer will shorten. */
  seamSeconds: number
}

/**
 * Work out the repeating region of a decoded buffer.
 *
 * `loopSeconds` comes from the track table and is measured from the first real
 * sample; the lead-in is found here so that a decoder which strips the padding
 * and one which keeps it both land on the same music.
 */
export function loopRegion(buffer: AudioBuffer, loopSeconds: number): LoopRegion {
  const rate = buffer.sampleRate
  const limit = Math.min(buffer.length, Math.round(rate * LEAD_IN_SEARCH_SECONDS))

  /*
   * Once each, outside the loop, and this is not a micro-optimisation.
   *
   * `getChannelData` reads as a property access and is not one: on Chrome it
   * costs time proportional to the *whole* buffer, so calling it per sample
   * across a second of a three-minute stereo piece is eighty-eight thousand
   * passes over sixty megabytes. Measured at twenty-six seconds of blocked
   * main thread on the piece that plays during a session — the app froze
   * between pressing play and the music arriving. Hoisted, the same scan is
   * under a millisecond.
   */
  const channels: Float32Array[] = []
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    channels.push(buffer.getChannelData(channel))
  }

  let lead = 0
  outer: while (lead < limit) {
    for (const samples of channels) {
      if (Math.abs(samples[lead]) >= SILENCE) break outer
    }
    lead += 1
  }
  if (lead >= limit) lead = 0

  const offsetSeconds = lead / rate
  const available = buffer.duration - offsetSeconds
  const lengthSeconds = Math.min(loopSeconds, available)
  // A seam cannot be longer than a third of what it joins, or the piece would
  // spend more time crossfading with itself than playing.
  const seamSeconds = Math.min(SEAM_SECONDS, lengthSeconds / 3)

  return {
    offsetSeconds,
    lengthSeconds,
    periodSeconds: lengthSeconds - seamSeconds,
    seamSeconds,
  }
}

/**
 * A decoded buffer, playing forever, behind one gain node.
 *
 * The gain is the caller's: it is what a track-to-track crossfade moves, and
 * this class never touches it. Everything here is about the inside of one
 * piece; everything about which piece is playing lives in the manager.
 */
export class LoopVoice {
  readonly output: GainNode

  private readonly ctx: BaseAudioContext
  private readonly buffer: AudioBuffer
  private readonly region: LoopRegion
  private readonly sources = new Set<AudioBufferSourceNode>()

  /** Context time the next repetition is due to begin. */
  private nextAt = 0
  /**
   * The context time the repeating region's *origin* sits at.
   *
   * Every repetition begins one period after the last, so they are all
   * congruent to this modulo the period — which means the phase can be read at
   * any moment from one subtraction, without tracking which repetition is
   * currently sounding.
   */
  private originAt = 0
  /** The phase held while stopped, so it survives being read after the fact. */
  private restingPhase = 0
  private running = false

  constructor(ctx: BaseAudioContext, buffer: AudioBuffer, loopSeconds: number) {
    this.ctx = ctx
    this.buffer = buffer
    this.region = loopRegion(buffer, loopSeconds)
    this.output = ctx.createGain()
    this.output.gain.value = 0
  }

  /** How long one time round lasts. */
  get periodSeconds(): number {
    return this.region.periodSeconds
  }

  /**
   * Where in the piece this voice is now, in seconds into the repeating
   * region.
   *
   * Read when a voice is retired so the same piece can be picked up where it
   * left off if the person comes back to that part of the app — which is what
   * makes a walk to the library and back sound like one continuous piece
   * rather than two visits to its opening.
   */
  get phaseSeconds(): number {
    const period = this.region.periodSeconds
    if (!this.running || period <= 0) return this.restingPhase
    return clampPhase(this.ctx.currentTime - this.originAt, period)
  }

  /**
   * Begin, at `when`, from `phaseSeconds` into the piece.
   *
   * The first repetition does not fade in: arriving is the manager's fade, and
   * two fades on top of each other is a fade the wrong shape.
   */
  start(when: number, phaseSeconds = 0): void {
    if (this.running) return
    this.running = true

    const { offsetSeconds, lengthSeconds, seamSeconds, periodSeconds } = this.region
    const phase = periodSeconds > 0 ? clampPhase(phaseSeconds, periodSeconds) : 0

    this.originAt = when - phase
    this.restingPhase = phase

    const remaining = lengthSeconds - phase
    this.play(when, offsetSeconds + phase, remaining, false)
    this.nextAt = when + remaining - seamSeconds

    this.tick()
  }

  /**
   * Keep the schedule `HORIZON_SECONDS` ahead of the clock.
   *
   * A loop is a minute or more long, so in the ordinary case this does nothing
   * at all for a very long time and then schedules exactly one repetition.
   * Called on every heartbeat, which is cheap enough to be beneath noticing
   * and is the only clock a hidden tab cannot slow down.
   */
  tick(): void {
    if (!this.running) return
    const { offsetSeconds, lengthSeconds, periodSeconds } = this.region
    if (periodSeconds <= 0) return

    const now = this.ctx.currentTime

    /*
     * A repetition that came due while nobody was scheduling.
     *
     * A suspended context cannot reach here — its clock stops, so the horizon
     * stops moving too — but a starved audio thread on a phone under load can,
     * and if it does the honest answer is to start the next repetition now
     * rather than to fire every repetition that was missed on top of each
     * other. The origin moves with it, so the phase stays a true reading.
     */
    if (this.nextAt < now) {
      this.nextAt = now
      this.originAt = now
    }

    while (this.nextAt < now + HORIZON_SECONDS) {
      this.play(this.nextAt, offsetSeconds, lengthSeconds, true)
      this.nextAt += periodSeconds
    }
  }

  /**
   * Fade out over `seconds` and release everything afterwards.
   *
   * The gain is the caller's, so the fade is theirs too; this only stops the
   * sources once it is over. Called with `0` when the page is going away.
   */
  stop(seconds: number): void {
    if (!this.running) return
    this.restingPhase = this.phaseSeconds
    this.running = false

    const end = this.ctx.currentTime + Math.max(0, seconds)
    for (const source of this.sources) {
      try {
        source.stop(end)
      } catch {
        /* Already stopped, or never started. */
      }
    }
  }

  /** Everything, now, whatever it was doing. */
  dispose(): void {
    this.stop(0)
    for (const source of this.sources) {
      try {
        source.disconnect()
      } catch {
        /* Already released. */
      }
    }
    this.sources.clear()
    try {
      this.output.disconnect()
    } catch {
      /* Already released. */
    }
  }

  /** One repetition, with its half of the seam written onto its own gain. */
  private play(
    when: number,
    bufferOffset: number,
    duration: number,
    fadeIn: boolean,
  ): void {
    const { seamSeconds } = this.region
    const start = Math.max(when, this.ctx.currentTime)

    const gain = this.ctx.createGain()
    gain.gain.value = fadeIn ? 0 : 1
    gain.connect(this.output)

    if (fadeIn) scheduleFade(gain.gain, 0, 1, start, seamSeconds)
    // The tail always fades, including on the very last repetition before a
    // stop: there is no way to know in advance which one that is, and a fade
    // nothing crosses into is simply the piece ending gently.
    scheduleFade(gain.gain, 1, 0, start + duration - seamSeconds, seamSeconds)

    const source = this.ctx.createBufferSource()
    source.buffer = this.buffer
    source.connect(gain)
    source.onended = () => {
      this.sources.delete(source)
      try {
        source.disconnect()
        gain.disconnect()
      } catch {
        /* Already released. */
      }
    }

    this.sources.add(source)
    source.start(start, bufferOffset, duration)
    // A hard stop in case `duration` outlives the buffer by a rounding error.
    source.stop(start + duration)
  }
}

function clampPhase(value: number, period: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return ((value % period) + period) % period
}
