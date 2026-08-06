/**
 * The three AI services Manifester can borrow, and how to reach each one.
 *
 * Every call goes straight from this page to the provider — there is no
 * Manifester server in between, and there could not be: the app is a folder of
 * static files on GitHub Pages. That is also why the key belongs to whoever
 * set it up rather than to us. It is stored on this device only, and sent to
 * exactly one place: the company whose key it is.
 *
 * Each SDK is loaded with a dynamic `import()` at the moment it is first
 * needed. The offline core of the app — write, speak, breathe, loop — never
 * downloads any of them, so turning this feature off costs nothing at all.
 */

/*
 * ChatGPT is deliberately absent, and it is worth writing down why so nobody
 * adds it back and ships a button that cannot work.
 *
 * `api.openai.com` sends no `Access-Control-Allow-Origin` header, so a browser
 * refuses the request before it is ever sent — measured here as a bare
 * `TypeError: Failed to fetch`, from the same page where Anthropic and Google
 * both answered normally. Only OpenAI can change that. The workaround is a
 * server that holds the key and forwards the call, which is exactly the
 * infrastructure this bring-your-own-key design exists to avoid. A public CORS
 * proxy would "fix" it by routing somebody's private affirmations and a live
 * API key through a stranger's server, which is not a trade worth making.
 */
export type ProviderId = 'claude' | 'gemini'

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
  /** How a key from this provider starts, for a friendly "that doesn't look right". */
  keyPrefix: string
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
}

export const PROVIDERS: Provider[] = [
  {
    id: 'claude',
    name: 'Claude',
    company: 'Anthropic',
    blurb: 'Warmest writing of the three. Best at keeping your voice.',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    steps: [
      'Open console.anthropic.com and sign in, or make a free account.',
      'You will land on the API keys page. Press “Create Key”.',
      'Give it any name — “Manifester” works — and press Create.',
      'Press the copy button. This is the only time the key is shown.',
      'Come back here and paste it in the box below.',
      'Anthropic asks for a payment card before the key works. Add $5; at this app’s usage that lasts a very long time.',
    ],
    keyPrefix: 'sk-ant-',
    keyExample: 'sk-ant-api03-…',
    cost: 'About 1¢ per press. $5 of credit is roughly 500 presses.',
    privacy:
      'Anthropic does not train on words sent through the API, and no person reads them.',
    humanReview: false,
  },
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
      'Press the copy button.',
      'Come back here and paste it in the box below.',
      'No card needed for the free tier — but please read the privacy note below before choosing this one.',
    ],
    keyPrefix: 'AIza',
    keyExample: 'AIzaSy…',
    cost: 'Free, within a daily limit. No card required.',
    // This is the whole reason the field exists. Google's own API terms say
    // that on the unpaid tier "human reviewers may read, annotate, and process
    // your API input and output" and that the content is used to improve
    // Google products. For a diary of private affirmations that is a real
    // cost, and it is not the kind of thing a person should discover later.
    privacy:
      'On the free tier, Google uses what you send to improve its products, and human reviewers may read it. Free costs something here. Paying for Gemini turns this off.',
    humanReview: true,
  },
]

export function findProvider(id: ProviderId): Provider {
  const provider = PROVIDERS.find((item) => item.id === id)
  if (!provider) throw new Error(`Unknown provider: ${id}`)
  return provider
}

/** A key that cannot possibly work, caught before spending a request on it. */
export function keyLooksWrong(id: ProviderId, key: string): string | null {
  const provider = findProvider(id)
  const trimmed = key.trim()
  if (!trimmed) return 'Paste the key first.'
  if (trimmed.length < 20) return 'That looks too short to be a full key.'
  if (!trimmed.startsWith(provider.keyPrefix)) {
    return `A ${provider.name} key starts with “${provider.keyPrefix}”. This one does not — is it from a different service?`
  }
  return null
}

/**
 * How the model is told to behave, for all three providers.
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
- Promise nothing about the future or the outside world. No claims about money arriving, people changing, or illness lifting. These are statements about how someone meets their life, not predictions.
- Plain, warm, speakable. Under fourteen words a line. No metaphors that need decoding, no therapy jargon, no exclamation marks, no emoji.
- Their voice, not yours. Keep their vocabulary and their register.

Output format, which is also not negotiable:
- Return only affirmation lines, one per line.
- No numbering, no bullets, no quote marks, no preamble, no sign-off, no explanation of your choices.
- If you cannot follow an instruction, return fewer lines rather than breaking format.`

/** Enough room for a short reply plus the thinking that precedes it. */
const MAX_TOKENS = 2000

async function callClaude(key: string, prompt: string, signal: AbortSignal) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true })
  const message = await client.messages.create(
    {
      model: 'claude-opus-5',
      max_tokens: MAX_TOKENS,
      // Thinking is on by default on this model and shares the max_tokens
      // budget with the reply, so the budget above is generous and the effort
      // is low: this is a short rewrite, not a research task.
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    },
    { signal },
  )
  if (message.stop_reason === 'refusal') {
    throw new Error('The model declined to answer this one.')
  }
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
}

async function callGemini(key: string, prompt: string, signal: AbortSignal) {
  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey: key })
  const interaction = await ai.interactions.create(
    { model: 'gemini-3.6-flash', input: `${SYSTEM}\n\n${prompt}` },
    { signal },
  )
  return interaction.output_text ?? ''
}

/**
 * Ask the chosen provider one question and hand back its raw reply.
 *
 * Errors are rewritten into something a person can act on. "401" tells you
 * nothing; "that key was not accepted" tells you to go and make a new one.
 */
export async function askProvider(
  id: ProviderId,
  key: string,
  prompt: string,
  signal: AbortSignal,
): Promise<string> {
  try {
    if (id === 'claude') return await callClaude(key, prompt, signal)
    return await callGemini(key, prompt, signal)
  } catch (error) {
    throw new Error(explain(error, findProvider(id)))
  }
}

function explain(error: unknown, provider: Provider): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'That took too long, so it was stopped.'
  }

  const status = (error as { status?: number })?.status
  const message = error instanceof Error ? error.message : String(error)

  /*
   * Google answers a bad key with 400 INVALID_ARGUMENT rather than 401, and
   * its SDK swallows the readable part of the body — the thrown message is
   * `400 API error occurred: {"httpMeta":{…}}`, which tells a person nothing.
   * Since this app controls the request shape, a 400 from Gemini in practice
   * only ever means the key.
   */
  if (status === 401 || status === 403 || (status === 400 && provider.id === 'gemini')) {
    return `${provider.name} did not accept that key. Check it was copied whole, and that it has not been deleted.`
  }
  if (status === 429) {
    return `${provider.name} is asking you to slow down. Wait a minute and try again.`
  }
  if (status === 402 || /credit|quota|billing|insufficient/i.test(message)) {
    return `That ${provider.company} account is out of credit. Top it up and try again.`
  }
  if (status != null && status >= 500) {
    return `${provider.name} is having trouble right now. Your words are untouched — try again shortly.`
  }
  if (/failed to fetch|connection error|network|offline/i.test(message)) {
    return `Could not reach ${provider.company}. Check the connection.`
  }
  return message || 'Something went wrong reaching the provider.'
}
