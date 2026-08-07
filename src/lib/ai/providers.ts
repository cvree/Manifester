/**
 * The AI service Manifester can borrow, and how to reach it.
 *
 * Every call goes straight from this page to the provider — there is no
 * Manifester server in between, and there could not be: the app is a folder of
 * static files on GitHub Pages. That is also why the key belongs to whoever
 * set it up rather than to us. It is stored on this device only, and sent to
 * exactly one place: the company whose key it is.
 *
 * The SDK is loaded with a dynamic `import()` at the moment it is first
 * needed. The offline core of the app — write, speak, breathe, loop — never
 * downloads it, so turning this feature off costs nothing at all.
 */

/*
 * One provider, and it is worth writing down why so nobody re-adds the others
 * without reading this.
 *
 * Claude was offered alongside Gemini and has been removed. Not because it
 * wrote badly — it wrote beautifully — but because offering two made the
 * first screen a decision instead of an instruction, and the second option
 * needed a payment card before it would answer at all. A free key and one set
 * of numbered steps is a better app than a menu.
 *
 * ChatGPT was never offered and cannot be. `api.openai.com` sends no
 * `Access-Control-Allow-Origin` header, so a browser refuses the request
 * before it is ever sent — measured here as a bare `TypeError: Failed to
 * fetch`, from the same page where Google answered normally. Only OpenAI can
 * change that. The workaround is a server that holds the key and forwards the
 * call, which is exactly the infrastructure this bring-your-own-key design
 * exists to avoid. A public CORS proxy would "fix" it by routing somebody's
 * private affirmations and a live API key through a stranger's server, which
 * is not a trade worth making.
 */
import {
  AiFailure,
  classifyFailure,
  throwIfAborted,
  type ProviderLabel,
} from './errors'

export type ProviderId = 'gemini'

/** One model to try, with the settings that model understands. */
interface Attempt {
  model: string
  /**
   * Only sent to models that know the field. An older model answers an
   * unfamiliar generation setting with a 400, which reads to a person as
   * "your key is broken" — so it is opt-in per model rather than global.
   */
  thinking?: 'minimal' | 'low'
}

export interface Provider {
  id: ProviderId
  /** What people call it. */
  name: string
  company: string
  /** Shown under the name, one line. */
  blurb: string
  /** Where to get a key. */
  consoleUrl: string
  /** Numbered, deliberately dull, written for someone who has never seen an API. */
  steps: string[]
  /**
   * Placeholder text for the paste box.
   *
   * Deliberately plural where a provider has more than one live key format.
   * Nothing is ever rejected for failing to match it — see `checkKeyFormat`.
   */
  keyExample: string
  /** Plain-English money. */
  cost: string
  /**
   * What the provider does with the words. This is the part people actually
   * need and never get told, so it is a first-class field rather than a
   * footnote — see the Gemini entry for why it earns the space.
   */
  privacy: string
  /** True when the provider may have humans read the text. */
  humanReview: boolean
  /**
   * Models to try, best first.
   *
   * More than one because a key's access is not knowable from here: a new
   * account, a different region, a used-up daily allowance on one model and
   * not another. Rather than tell somebody their key is broken when it is
   * simply a model they cannot have today, the next one down is tried.
   */
  attempts: Attempt[]
}

export const PROVIDERS: Provider[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    company: 'Google',
    blurb: 'Has a genuinely free tier — but read the note below first.',
    consoleUrl: 'https://aistudio.google.com/apikey',
    steps: [
      'Open aistudio.google.com/apikey and sign in with a Google account.',
      'Press “Create API key”.',
      'Choose any project it offers, or let it make one.',
      'Press the copy button. Google’s newer keys begin with “AQ.”; older ones begin with “AIza”. Manifester accepts either — it checks the key by using it, not by looking at it.',
      'Come back here and paste it in the box below.',
      'No card needed for the free tier — but please read the privacy note below before choosing this one.',
    ],
    keyExample: 'AQ.… or AIza…',
    cost: 'Free, within Google’s daily limits. No card required.',
    // This is the whole reason the field exists. Google's own API terms say
    // that on the unpaid tier "human reviewers may read, annotate, and process
    // your API input and output" and that the content is used to improve
    // Google products. For a diary of private affirmations that is a real
    // cost, and it is not the kind of thing a person should discover later.
    privacy:
      'On the free tier, Google uses what you send to improve its products, and human reviewers may read it. Free costs something here. Paying for Gemini turns this off — as does being in the UK, Switzerland or the EEA, where the paid terms apply to everyone.',
    humanReview: true,
    /*
     * Flash first, Flash-Lite behind it. This is a handful of short lines of
     * writing, not a research task, so the smallest current model is genuinely
     * the right tool — and it is the one with the most generous free
     * allowance, which is the tier most people arrive on.
     */
    attempts: [
      { model: 'gemini-3.6-flash', thinking: 'low' },
      { model: 'gemini-flash-latest', thinking: 'low' },
      { model: 'gemini-flash-lite-latest' },
      { model: 'gemini-2.5-flash-lite' },
    ],
  },
]

/**
 * Is this string still a provider this app can talk to?
 *
 * It matters because the answer has changed. A device that connected Claude
 * before it was removed still has that record in its IndexedDB, and every
 * screen that reaches for a provider by id would throw on it — a stored key
 * from last week turning the About page white.
 */
export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && PROVIDERS.some((provider) => provider.id === value)
}

/** The one provider, for the screens that no longer need to ask which. */
export const PROVIDER: Provider = PROVIDERS[0]

export function findProvider(id: ProviderId): Provider {
  const provider = PROVIDERS.find((item) => item.id === id)
  if (!provider) throw new Error(`Unknown provider: ${id}`)
  return provider
}

export function providerLabel(id: ProviderId): ProviderLabel {
  const { name, company } = findProvider(id)
  return { id, name, company }
}

/**
 * Clean up a pasted key without changing what it is.
 *
 * A key copied from a web page, a terminal, or a password manager arrives
 * with a trailing newline, a wrapped line break in the middle, or a pair of
 * quotes around it, and any of those turn a perfectly good key into a request
 * that fails for a reason nobody can see. No key format from any provider
 * contains whitespace or quotes, so removing them can only help.
 */
export function normaliseKey(raw: string): string {
  return raw
    .trim()
    // A key pasted out of code or JSON, still wearing its quotes.
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')
    // Someone copied the header, not the value.
    .replace(/^bearer\s+/i, '')
    // Line breaks from a wrapped terminal, or a stray space from a touch
    // keyboard's autocorrect. Nothing legitimate is lost here.
    .replace(/\s+/g, '')
}

export type KeyCheck =
  | { level: 'error'; message: string }
  | { level: 'hint'; message: string }
  | null

/*
 * Prefixes are a *hint*, never a verdict.
 *
 * Manifester used to refuse anything that did not begin with `AIza`, and then
 * Google moved Google AI Studio to auth keys, which begin with `AQ.` — so the
 * app started rejecting brand-new, perfectly valid keys before it had spent a
 * single request finding out. That is the failure mode this whole file is
 * arranged to prevent: the only thing that decides whether a key works is
 * asking the provider, and formats will change again.
 *
 * These lists exist for one narrow purpose — noticing a key that plainly
 * belongs to a *different company*, which is a real and common mistake — and
 * even then the answer is a note beside the box, not a locked button.
 */
const FAMILIAR_PREFIXES: Record<ProviderId, string[]> = {
  gemini: ['AQ.', 'AIza'],
}

/** Prefixes that belong to somebody else entirely. */
const OTHER_COMPANY: { prefix: string; whose: string }[] = [
  { prefix: 'sk-ant-', whose: 'Anthropic' },
  { prefix: 'sk-proj-', whose: 'OpenAI' },
  { prefix: 'sk-or-', whose: 'OpenRouter' },
  { prefix: 'sk-', whose: 'OpenAI' },
  { prefix: 'AQ.', whose: 'Google' },
  { prefix: 'AIza', whose: 'Google' },
  { prefix: 'ghp_', whose: 'GitHub' },
  { prefix: 'xai-', whose: 'xAI' },
  { prefix: 'gsk_', whose: 'Groq' },
]

/**
 * Everything worth saying about a pasted key *before* trying it.
 *
 * `error` blocks the Connect button and is reserved for a string that cannot
 * be a key at all — empty, or far too short to be one. `hint` is advice shown
 * beside the box while Connect stays available, because the person in front of
 * the screen may well know something this function does not.
 */
export function checkKeyFormat(id: ProviderId, key: string): KeyCheck {
  const provider = findProvider(id)
  const trimmed = normaliseKey(key)

  if (!trimmed) return { level: 'error', message: 'Paste the key first.' }
  if (trimmed.length < 20) {
    return {
      level: 'error',
      message: 'That is too short to be a whole key — check all of it was copied.',
    }
  }
  if (trimmed.length > 400) {
    return {
      level: 'error',
      message: 'That is far longer than a key. Some other text was probably copied with it.',
    }
  }

  const foreign = OTHER_COMPANY.find(
    (entry) =>
      trimmed.startsWith(entry.prefix) &&
      entry.whose !== provider.company &&
      !FAMILIAR_PREFIXES[id].some((prefix) => trimmed.startsWith(prefix)),
  )
  if (foreign) {
    return {
      level: 'hint',
      message: `That looks like a ${foreign.whose} key rather than a ${provider.company} one. Connect anyway if you are sure — it will be tested for real either way.`,
    }
  }

  if (/[^A-Za-z0-9._~+/=:-]/.test(trimmed)) {
    return {
      level: 'hint',
      message:
        'There are unusual characters in there, so some of the surrounding page may have been copied too. Connect will tell you for certain.',
    }
  }

  return null
}

export type GeminiKeyStyle = 'auth' | 'legacy' | 'unfamiliar'

/**
 * Which of Google's two live key formats this looks like.
 *
 * Used for one friendly line under the paste box and nothing else. Both work;
 * `unfamiliar` is not a complaint, it is "we have not seen this shape before,
 * and we are going to try it anyway".
 */
export function geminiKeyStyle(key: string): GeminiKeyStyle {
  const trimmed = normaliseKey(key)
  if (trimmed.startsWith('AQ.')) return 'auth'
  if (trimmed.startsWith('AIza')) return 'legacy'
  return 'unfamiliar'
}

export function describeGeminiKeyStyle(style: GeminiKeyStyle): string | null {
  switch (style) {
    case 'auth':
      return 'That is one of Google’s newer auth keys — the format Google AI Studio hands out now.'
    case 'legacy':
      return 'That is one of Google’s older keys. It works as long as your account still accepts it.'
    default:
      // Silence on purpose. Google changes this; the connection test decides.
      return null
  }
}

/**
 * How the model is told to behave, for both providers.
 *
 * The instructions are blunt about format because the reply is parsed as
 * lines, not read by a person. They are blunt about scope because current
 * models otherwise offer encouragement, explain their choices, and hand back
 * more than was asked for — all lovely, and all noise to a line parser.
 */
const SYSTEM = `You help someone write spoken affirmations for a calm looping meditation app.

House style, which is not negotiable:
- Present tense, first person. "I am steady", never "I will be steady" or "you are steady".
- Say the thing they want, never the thing they are avoiding. No "not", "never", "no longer".
- Promise nothing about the future or the outside world. No claims about money arriving, people changing, or illness lifting. Nothing about curing, healing or guaranteeing anything. These are statements about how someone meets their life, not predictions and not medicine.
- Plain, warm, speakable. Under fourteen words a line. No metaphors that need decoding, no therapy jargon, no exclamation marks, no emoji.
- Their voice, not yours. Keep their vocabulary and their register.

Output format, which is also not negotiable:
- Return only affirmation lines, one per line.
- No numbering, no bullets, no quote marks, no preamble, no sign-off, no explanation of your choices.
- If you cannot follow an instruction, return fewer lines rather than breaking format.`

/** Enough room for a short reply plus the thinking that precedes it. */
const MAX_TOKENS = 3000

/**
 * The connection test wants a yes or a no, not an essay.
 *
 * Not as small as it could be, deliberately. On both providers this budget is
 * shared with the model's own thinking, and a budget so tight that a healthy
 * model runs out of room would fail a key that is perfectly good — which is
 * the one mistake this whole path exists to stop making. A thousand tokens
 * costs a fraction of a cent; a false "that key does not work" costs a user.
 */
const TEST_TOKENS = 1024

export interface ProviderReply {
  text: string
  /** The model that actually answered, which may not be the first one asked. */
  model: string
}

/**
 * Ask the chosen provider one question and hand back its raw reply.
 *
 * `preferModel` is the model that worked last time. Starting there means the
 * common case is one request rather than a walk down the list, while an
 * account whose access changes is still carried by the fallback.
 */
export async function askProvider(
  id: ProviderId,
  key: string,
  prompt: string,
  signal: AbortSignal,
  preferModel?: string,
): Promise<ProviderReply> {
  if (id !== 'gemini') throw new AiFailure('unknown', `Unknown provider: ${id}`, id)
  return callGemini(key, prompt, signal, { preferModel, maxTokens: MAX_TOKENS })
}

/**
 * Spend one tiny request finding out whether a key actually works.
 *
 * This is the only thing that decides "connected", and it is deliberately the
 * only thing: no prefix, no length, no shape of the string can tell you
 * whether a credential is live, and every version of this app that pretended
 * otherwise ended up refusing keys that were perfectly good.
 *
 * A 200 is a pass even when the model returns no text. The question being
 * asked here is "will this key authenticate", not "can this model write".
 */
export async function verifyConnection(
  id: ProviderId,
  key: string,
  signal: AbortSignal,
): Promise<{ model: string }> {
  const prompt = 'Reply with the single word: ready'
  if (id !== 'gemini') throw new AiFailure('unknown', `Unknown provider: ${id}`, id)
  const reply = await callGemini(key, prompt, signal, {
    maxTokens: TEST_TOKENS,
    allowEmpty: true,
  })
  return { model: reply.model }
}

interface GeminiOptions {
  preferModel?: string
  maxTokens: number
  /** True for the connection test, where a silent 200 still proves the key. */
  allowEmpty?: boolean
}

/**
 * Walk the Flash models until one of them answers.
 *
 * Only two kinds of failure are worth moving on for: the model is not
 * available to this key, and this model's allowance is spent. Everything else
 * — a refused key, no network, Google being down — would fail identically on
 * every model, and retrying it four times just makes the person wait four
 * times as long for the same bad news.
 */
async function callGemini(
  key: string,
  prompt: string,
  signal: AbortSignal,
  options: GeminiOptions,
): Promise<ProviderReply> {
  const label = providerLabel('gemini')
  const attempts = orderAttempts(findProvider('gemini').attempts, options.preferModel)
  throwIfAborted(signal, label)

  let sdk: typeof import('@google/genai')
  try {
    sdk = await import('@google/genai')
  } catch (error) {
    throw classifyFailure(error, label, signal)
  }

  const ai = new sdk.GoogleGenAI({ apiKey: key })
  let last: AiFailure | null = null

  for (const attempt of attempts) {
    try {
      throwIfAborted(signal, label)
      const interaction = await ai.interactions.create(
        {
          model: attempt.model,
          system_instruction: SYSTEM,
          input: prompt,
          // Nothing about this belongs in a conversation history on Google's
          // side, and the app never asks for an interaction back by id.
          store: false,
          generation_config: {
            max_output_tokens: options.maxTokens,
            ...(attempt.thinking ? { thinking_level: attempt.thinking } : {}),
          },
        },
        // Retries are ours to decide: the deadline is shared with the person
        // waiting, and a silent retry inside the SDK spends it invisibly.
        { signal, maxRetries: 0 },
      )

      const text = readInteractionText(interaction)
      if (!text && !options.allowEmpty) {
        throw emptyReply(interaction)
      }
      return { text, model: attempt.model }
    } catch (error) {
      const failure = classifyFailure(error, label, signal)
      if (failure.kind !== 'model' && failure.kind !== 'quota') throw failure
      last = failure
    }
  }

  throw (
    last ??
    new AiFailure('model', `No ${label.name} model was available to that key.`, 'gemini')
  )
}

/** The remembered model first, then everything else in its usual order. */
function orderAttempts(attempts: Attempt[], preferModel?: string): Attempt[] {
  if (!preferModel) return attempts
  const preferred = attempts.find((attempt) => attempt.model === preferModel)
  if (!preferred) return attempts
  return [preferred, ...attempts.filter((attempt) => attempt !== preferred)]
}

/**
 * Pull the text out of an interaction, defensively.
 *
 * `output_text` is the SDK's own convenience field and is what a healthy
 * response carries. The walk over `steps` is the safety net for a response
 * shaped in some way this version does not expect — better to find the words
 * in an unfamiliar envelope than to tell somebody their key is broken.
 */
export function readInteractionText(interaction: unknown): string {
  const direct = (interaction as { output_text?: unknown })?.output_text
  if (typeof direct === 'string' && direct.trim()) return direct.trim()

  const collected: string[] = []
  collectText((interaction as { steps?: unknown })?.steps, collected, 0)
  return collected.join('\n').trim()
}

function collectText(node: unknown, into: string[], depth: number): void {
  if (depth > 6 || node == null || into.length > 64) return
  if (Array.isArray(node)) {
    for (const item of node) collectText(item, into, depth + 1)
    return
  }
  if (typeof node !== 'object') return
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === 'text' && typeof value === 'string' && value.trim()) into.push(value.trim())
    else collectText(value, into, depth + 1)
  }
}

/**
 * A 200 with nothing in it.
 *
 * Usually a safety filter, occasionally a model that spent its whole budget
 * thinking. Both are worth saying out loud, because "nothing happened" with no
 * explanation is the single most frustrating thing a button can do.
 */
function emptyReply(interaction: unknown): AiFailure {
  let serialised = ''
  try {
    serialised = JSON.stringify(interaction ?? {}).slice(0, 2000).toLowerCase()
  } catch {
    // Unserialisable: fall through to the general message.
  }
  const blocked = /safety|blocked|prohibited|recitation/.test(serialised)
  return new AiFailure(
    'empty',
    blocked
      ? 'Gemini held that one back rather than answering it. Your words are untouched — rewording the line it stopped on usually clears it.'
      : 'Gemini answered with nothing at all. Your words are untouched — press again.',
    'gemini',
  )
}
