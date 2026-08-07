/**
 * The AI versions of "Add to my words" and "Improve my words".
 *
 * Same two buttons, same two results, same Undo — only the engine behind them
 * changes. When no key is set up, or the provider is unreachable, the caller
 * falls back to the offline rule engine in `../wordcraft` and the person
 * mostly cannot tell.
 *
 * This is where Add actually got better. The offline engine picks from a fixed
 * pool, so pressing it repeatedly eventually runs out of things to say. Here
 * the whole current draft goes up every time, with an instruction not to
 * repeat any of it — so the fourth press is as fresh as the first, and each
 * batch is built on the words that were there a moment ago rather than on a
 * theme guessed from keywords.
 *
 * One rule runs through all of it: the draft is not touched until a reply has
 * come back *and* survived `sanitiseLines`. A failure at any point leaves the
 * text exactly as it was.
 */

import { affirmationLines } from '../summaries'
import type { WordcraftResult } from '../wordcraft'
import type { Credentials } from './credentials'
import { AiFailure, classifyFailure } from './errors'
import { askProvider, findProvider, providerLabel } from './providers'

const ADDED_LINES = 3

/**
 * Strip everything a model adds when it is being helpful.
 *
 * Numbering, bullets, surrounding quotes, stray markdown, and the "Here are
 * three lines:" preamble that no amount of formatting instruction fully
 * prevents. Anything left that does not look like an affirmation is dropped
 * rather than shown — a bad line in someone's ritual is worse than a short one.
 */
export function sanitiseLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) =>
      line
        // Control characters and zero-width joiners a model occasionally
        // emits. They are invisible on screen and audible as nothing, but
        // they break the line-length checks below and the speech engine.
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f\u200b-\u200f\u2028\u2029\ufeff]/g, '')
        .trim()
        // "1. ", "1) ", "- ", "* ", "• "
        .replace(/^\s*(?:\d+[.)]|[-*•—])\s+/, '')
        // Wrapping quotes, straight or curly.
        .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
        // Leftover bold/italic markers.
        .replace(/\*\*|__/g, '')
        .trim(),
    )
    .filter((line) => {
      if (!line) return false
      // A heading or preamble rather than an affirmation.
      if (line.endsWith(':')) return false
      /*
       * Commentary about the task rather than an affirmation. Two checks: the
       * ways an assistant opens a sentence to a person, and the words it uses
       * to talk about the work. `I'll` is in the opener list on purpose —
       * house style is present tense, so a line starting that way is one we
       * would reject anyway.
       */
      if (
        /^(here|these|those|i'd|i'll|i've|i have|sure|certainly|absolutely|of course|happy to|glad to|note|okay|ok)\b/i.test(
          line,
        )
      ) {
        return false
      }
      if (/\b(affirmation|line|version|rewrote|suggestion)s?\b/i.test(line)) return false
      if (/\b(let me know|hope (this|these|that) help|feel free)\b/i.test(line)) return false
      // Markdown fences and separators.
      if (/^[`#>\-=_]+$/.test(line)) return false
      // A single word is not a line somebody can say to themselves.
      if (line.split(/\s+/).length < 2) return false
      // Far too long to speak in one breath — the model has written prose.
      if (line.split(/\s+/).length > 24) return false
      if (line.length > 240) return false
      if (isUnsafeLine(line)) return false
      return true
    })
}

/*
 * The lines that must never reach somebody's ritual, whatever the model
 * thought it was doing.
 *
 * This is not squeamishness. An affirmation is repeated aloud, in a
 * suggestible state, dozens of times a session — so a line that promises a
 * cure, or guarantees an outcome the world controls, is not a harmless
 * flourish. It is a false statement being rehearsed until it feels true, and
 * the two places that does real damage are health and money.
 *
 * The system prompt already forbids all of this. This is the check that
 * assumes the prompt was ignored, because sooner or later it will be, and the
 * cost of dropping one good line is a great deal lower than the cost of
 * speaking one bad one. "I am healing" and "I am well" are deliberately still
 * allowed: the target is the promise, not the hope.
 */
const UNSAFE_PATTERNS: RegExp[] = [
  // Medicine: curing, diagnosis, and stopping treatment.
  /\b(cure[sd]?|curing|remission|malignan|tumou?r|cancer|diabetes|infection)\b/i,
  /\b(my|the)\s+(illness|disease|diagnosis|condition|symptoms?|pain)\b[^.]*\b(gone|vanish\w*|disappear\w*|heal(ed|ing)|cured|lift(ing|ed)|shrink\w*|fad(es?|ing))\b/i,
  /\b(no longer need|stop taking|off)\s+(my\s+)?(medication|medicine|pills|treatment|insulin|chemo)/i,
  /\b(doctors?|medicine|surgery|treatment)\b[^.]*\b(unnecessary|not needed|wrong)\b/i,
  /\bheals?\b[^.]*\b(my|the)\s+(body|cells|blood|organs?)\b/i,
  // Guarantees about a world nobody controls.
  /\b(guarantee[sd]?|guaranteed|certain to|bound to|destined to|will definitely|always works|never fails)\b/i,
  /\b(the universe|god|fate)\b[^.]*\b(will|gives me|brings me|delivers|owes)\b/i,
  // Money arriving, which is the manifestation claim people are actually sold.
  /\b(money|wealth|cash|riches|abundance|fortune)\b[^.]*\b(is coming|will come|flows to me|arrives|pours in|is on its way)\b/i,
  /\bi will be (rich|wealthy|a millionaire|debt[- ]free)\b/i,
  // A figure in an affirmation is a target, and a target said aloud as a
  // present-tense fact is a promise about money.
  /[$£€]\s?\d/,
  /\b\d[\d,.]*\s*(k|m|million|thousand|dollars|pounds|euros)\b/i,
  // Promises about other people's behaviour.
  /\b(everyone|everybody|they|he|she)\s+will\s+(love|want|choose|approve|forgive|come back)\b/i,
]

export function isUnsafeLine(line: string): boolean {
  return UNSAFE_PATTERNS.some((pattern) => pattern.test(line))
}

function quoteDraft(text: string): string {
  const lines = affirmationLines(text)
  return lines.length ? lines.map((line) => `- ${line}`).join('\n') : '(nothing yet)'
}

/**
 * Extend the draft with lines that follow where it is already going.
 *
 * The draft is sent whole so the model can match its subject, its vocabulary,
 * and its level of intensity — and so it can see exactly what not to repeat.
 */
export async function aiAddToWords(
  text: string,
  title: string,
  credentials: Credentials,
  signal: AbortSignal,
): Promise<WordcraftResult> {
  const existing = affirmationLines(text)
  const prompt = existing.length
    ? `This is someone's affirmation loop so far.

${title.trim() ? `They titled it: ${title.trim()}` : 'It has no title yet.'}

Their lines:
${quoteDraft(text)}

Write exactly ${ADDED_LINES} NEW lines that make this loop stronger.

First work out what they are actually reaching for underneath these words —
the specific thing in their life, not the general theme. Then write lines that
give that reach more force.

- Stay inside their world. Use their subject, their situation, their
  vocabulary, their level of plainness. Someone reading the finished loop
  should not be able to tell which lines they wrote and which they did not.
- Every line must add power the loop does not have yet. Go somewhere new:
  a different angle on the same reach, something the earlier lines imply but
  never say outright, the harder thing they have been circling.
- Never repeat, reword or paraphrase a line above. If your line would still
  be true after deleting one of theirs, it is too close — write a different one.
- Make each line strong enough to stand alone, and true enough that they will
  believe it in their own voice.

They will press this button again. Leave the loop feeling built up, not
padded out.`
    : `Someone is starting an affirmation loop and has written nothing yet.

${title.trim() ? `They titled it: ${title.trim()} — write for exactly that, not for the general theme around it.` : 'They have not titled it, so write lines that would steady almost anyone.'}

Write exactly ${ADDED_LINES} lines to start them off. Make them strong and
specific enough to be worth keeping, and plain enough to edit into their own
words.`

  const reply = await askProvider(
    credentials.provider,
    credentials.key,
    prompt,
    signal,
    credentials.model,
  )
  const picked = dropDuplicates(sanitiseLines(reply.text), existing).slice(0, ADDED_LINES)

  /*
   * Nothing usable is a failure, not a result. Raising it means the caller's
   * fallback runs and the person gets the offline suggestion instead of a
   * button that visibly did nothing.
   */
  if (picked.length === 0) {
    throw new AiFailure(
      'empty',
      `${findProvider(credentials.provider).name} did not return anything usable.`,
      credentials.provider,
    )
  }

  const body = picked.join('\n')
  const next = text.trim() ? `${text.trimEnd()}\n${body}` : body
  const count = picked.length === 1 ? 'a line' : `${picked.length} lines`

  return {
    text: next,
    note: existing.length
      ? `Added ${count}, written around what you already had.`
      : `Added ${count} to start from — change any of them to sound like you.`,
    changed: true,
  }
}

/**
 * Rewrite the draft in place, keeping the meaning and losing the hedging.
 *
 * Line count and order are preserved so the result reads as *their* loop
 * edited, not a new one substituted. A reply with the wrong number of lines is
 * refused rather than guessed at — there is no honest way to map five rewrites
 * back onto four originals, and guessing wrong silently deletes a line
 * somebody wrote.
 */
export async function aiImproveWords(
  text: string,
  credentials: Credentials,
  signal: AbortSignal,
): Promise<WordcraftResult> {
  const existing = affirmationLines(text)
  if (existing.length === 0) {
    return { text, note: 'Write a line first.', changed: false }
  }

  const prompt = `Rewrite each of these lines to be as powerfully positive and as objective as you can make it, without changing what the person meant.

${existing.map((line, index) => `${index + 1}. ${line}`).join('\n')}

Powerful means:
- Present tense, first person, stated as a fact about now. "I am calm", never
  "I will be calm", "I want to be calm", or "I am trying to be calm".
- Declarative. Cut every hedge — maybe, hopefully, someday, a bit, I think.
- Strong enough to mean something when said out loud to an empty room.

Positive means:
- Say the thing they want, never the thing they are escaping. "I don't want to
  feel like a failure" becomes "I am learning and growing". No "not", "never",
  "no longer", "stop", "less".

Objective means:
- Concrete over vague. Name the actual thing rather than gesturing at a mood.
- True, or true enough that they will not flinch saying it. Do not inflate a
  line into something they cannot believe — "I am enough" survives being said
  on a bad day; "I am unstoppable" does not, and a line they reject is worse
  than the one they wrote.
- No promises about the future, other people, money, or health. These are
  statements about how they meet their life, not predictions about it.

Keep their meaning and their voice — this is an edit, not a replacement. If a
line is already all three things, return it exactly as it is rather than
fiddling with it.

Return exactly ${existing.length} lines, in the same order, one per line, unnumbered.`

  const reply = await askProvider(
    credentials.provider,
    credentials.key,
    prompt,
    signal,
    credentials.model,
  )
  const rewritten = sanitiseLines(reply.text)

  // A different number of lines means the model reorganised the loop instead
  // of editing it. Better to hand this to the offline engine than to guess.
  if (rewritten.length !== existing.length) {
    throw new AiFailure(
      'empty',
      `${findProvider(credentials.provider).name} returned a different set of lines, so nothing was changed.`,
      credentials.provider,
    )
  }

  const changedCount = rewritten.filter(
    (line, index) => normalise(line) !== normalise(existing[index]),
  ).length

  if (changedCount === 0) {
    return { text, note: 'These already read as present, positive and yours.', changed: false }
  }

  return {
    text: rewritten.join('\n'),
    note: `Reshaped ${changedCount} ${changedCount === 1 ? 'line' : 'lines'}, keeping your meaning.`,
    changed: true,
  }
}

function normalise(line: string): string {
  return line.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

/** Models paraphrase themselves when asked for more; catch the near-misses too. */
function dropDuplicates(candidates: string[], existing: string[]): string[] {
  const seen = new Set(existing.map(normalise))
  const kept: string[] = []
  for (const candidate of candidates) {
    const key = normalise(candidate)
    if (!key || seen.has(key)) continue
    if ([...seen].some((line) => line.length >= 12 && (line.includes(key) || key.includes(line)))) {
      continue
    }
    seen.add(key)
    kept.push(candidate)
  }
  return kept
}

export interface HelperOutcome {
  /** What to do to the draft. `null` means leave it completely alone. */
  result: WordcraftResult | null
  /** Set when the provider was tried and did not deliver. */
  failure: AiFailure | null
  /** True when the offline engine wrote the result instead. */
  usedFallback: boolean
}

/**
 * Run the provider, and quietly hand over to the offline engine if it fails.
 *
 * The whole point of the two helper buttons is that they always do something.
 * A key that expired overnight, a train going into a tunnel, a daily quota
 * that ran out — none of those should turn a press into a dead end, and none
 * of them should cost somebody the words already in the box.
 *
 * The exception is a deliberate stop. Somebody who presses Stop wants nothing
 * to happen, and helpfully substituting a different suggestion is not nothing.
 */
export async function helpWithFallback(
  online: () => Promise<WordcraftResult>,
  offline: () => WordcraftResult,
  providerId: Credentials['provider'],
): Promise<HelperOutcome> {
  try {
    return { result: await online(), failure: null, usedFallback: false }
  } catch (error) {
    const failure = classifyFailure(error, providerLabel(providerId))

    if (failure.kind === 'cancelled') {
      return { result: null, failure, usedFallback: false }
    }

    const fallback = offline()
    return {
      result: {
        ...fallback,
        note: `${failure.message} ${
          fallback.changed
            ? 'Manifester’s own helper wrote this one instead.'
            : 'Manifester’s own helper had nothing to add either.'
        }`,
      },
      failure,
      usedFallback: true,
    }
  }
}
