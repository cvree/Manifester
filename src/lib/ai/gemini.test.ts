import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * The Gemini connection, tested against a stand-in for `@google/genai`.
 *
 * The point of this file is that everything the app decides about a key — is
 * it valid, is it allowed, is it out of quota, should we try a smaller model,
 * should we hand over to the offline helper — is decided by what came *back*
 * from Google, never by what the key looked like going out. The first block
 * exists because Manifester once got that exactly wrong: it required keys to
 * start with `AIza`, Google moved Google AI Studio onto auth keys beginning
 * with `AQ.`, and every new key in the world started being rejected without a
 * single request being made.
 */

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  keysSeen: [] as (string | undefined)[],
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    interactions = { create: mocks.create }
    constructor(options: { apiKey?: string }) {
      mocks.keysSeen.push(options.apiKey)
    }
  },
}))

import { aiAddToWords, aiImproveWords, helpWithFallback } from './enhance'
import { AbortCause, AiFailure, classifyFailure, withTimeout } from './errors'
import {
  askProvider,
  checkKeyFormat,
  findProvider,
  geminiKeyStyle,
  isProviderId,
  normaliseKey,
  PROVIDERS,
  readInteractionText,
  verifyConnection,
} from './providers'
import type { Credentials } from './credentials'

/** A realistic modern Google AI Studio auth key. Not a real one. */
const AUTH_KEY = `AQ.Ab8RN6${'K3xQ7pLm2Vt9YwZr'.repeat(3)}` // AQ. prefix, 54 chars
/** A realistic older-style Google key. Also not a real one. */
const LEGACY_KEY = `AIzaSy${'B4dC0ffee1234567890abcdefGHIJKLM'.repeat(1)}`

function reply(text: string) {
  return { output_text: text }
}

/** An error shaped like the ones `@google/genai` throws. */
function googleError(status: number, error: unknown, message = ''): Error {
  const failure = new Error(message || `${status} request failed`)
  Object.assign(failure, { status, statusCode: status, error })
  return failure
}

function detail(code: number, message: string, extra: Record<string, unknown> = {}) {
  return { error: { code, message, status: 'ERROR', ...extra } }
}

/** A request that hangs until its signal aborts, the way `fetch` does. */
function respondsToAbort() {
  return (_params: unknown, options: { signal: AbortSignal }) =>
    new Promise<never>((_resolve, reject) => {
      const fail = () => {
        const aborted = new Error('Request aborted by client')
        aborted.name = 'APIUserAbortError'
        reject(aborted)
      }
      if (options.signal.aborted) fail()
      else options.signal.addEventListener('abort', fail, { once: true })
    })
}

async function ask(key: string, prompt = 'hello', preferModel?: string) {
  const { signal, done } = withTimeout(undefined, 5_000)
  try {
    return await askProvider('gemini', key, prompt, signal, preferModel)
  } finally {
    done()
  }
}

async function askForFailure(key: string): Promise<AiFailure> {
  try {
    await ask(key)
  } catch (error) {
    expect(error).toBeInstanceOf(AiFailure)
    return error as AiFailure
  }
  throw new Error('Expected the request to fail.')
}

beforeEach(() => {
  mocks.create.mockReset()
  mocks.keysSeen.length = 0
})

describe('a key from Google AI Studio today', () => {
  /*
   * The regression this whole task exists for. An `AQ.` key must reach the
   * network. If this fails, new users are being turned away at the door.
   */
  it('never refuses an AQ. auth key on the strength of its prefix', () => {
    expect(checkKeyFormat('gemini', AUTH_KEY)).toBeNull()
    expect(checkKeyFormat('gemini', `AQ.Ab8${'z'.repeat(60)}`)).toBeNull()
    expect(checkKeyFormat('gemini', `AQ.${'aA1_-'.repeat(12)}`)).toBeNull()
  })

  it('sends an AQ. key to Google and reports it connected', async () => {
    mocks.create.mockResolvedValue(reply('ready'))

    const { model } = await verifyConnection('gemini', AUTH_KEY, withTimeout().signal)

    expect(mocks.keysSeen).toEqual([AUTH_KEY])
    expect(model).toBe('gemini-3.6-flash')
  })

  it('still accepts an older AIza key', async () => {
    expect(checkKeyFormat('gemini', LEGACY_KEY)).toBeNull()
    mocks.create.mockResolvedValue(reply('ready'))

    await expect(
      verifyConnection('gemini', LEGACY_KEY, withTimeout().signal),
    ).resolves.toEqual({ model: 'gemini-3.6-flash' })
    expect(mocks.keysSeen).toEqual([LEGACY_KEY])
  })

  it('accepts a shape nobody has seen before, and lets Google decide', () => {
    // Whatever Google issues next must not need a code change here.
    expect(checkKeyFormat('gemini', `GX9.v2.${'q'.repeat(50)}`)).toBeNull()
    expect(checkKeyFormat('gemini', 'x'.repeat(40))).toBeNull()
  })

  it('never tells anyone a key has to start with AIza', () => {
    const everythingSaid = [
      ...findProvider('gemini').steps,
      findProvider('gemini').keyExample,
      findProvider('gemini').cost,
      checkKeyFormat('gemini', '')?.message ?? '',
      checkKeyFormat('gemini', 'short')?.message ?? '',
      checkKeyFormat('gemini', `sk-ant-api03-${'x'.repeat(40)}`)?.message ?? '',
      checkKeyFormat('gemini', `zz${'x'.repeat(40)}`)?.message ?? '',
    ].join(' ')

    expect(everythingSaid).not.toMatch(/must (start|begin)/i)
    expect(everythingSaid).not.toMatch(/does not start with/i)
    // Naming the format as one of several is fine; demanding it is not.
    expect(everythingSaid).not.toMatch(/keys? (start|begin)s? with .?AIza/i)
  })

  it('tells the two live Google formats apart, for a hint and nothing more', () => {
    expect(geminiKeyStyle(AUTH_KEY)).toBe('auth')
    expect(geminiKeyStyle(LEGACY_KEY)).toBe('legacy')
    expect(geminiKeyStyle('something-else-entirely')).toBe('unfamiliar')
  })

  it('cleans up a paste without changing the key', () => {
    expect(normaliseKey(`  ${AUTH_KEY}\n`)).toBe(AUTH_KEY)
    // A key wrapped across two lines by a terminal.
    expect(normaliseKey(`${AUTH_KEY.slice(0, 20)}\n${AUTH_KEY.slice(20)}`)).toBe(AUTH_KEY)
    expect(normaliseKey(`"${AUTH_KEY}"`)).toBe(AUTH_KEY)
    expect(normaliseKey(`Bearer ${AUTH_KEY}`)).toBe(AUTH_KEY)
  })

  it('blocks only what cannot be a key at all', () => {
    expect(checkKeyFormat('gemini', '   ')).toEqual({
      level: 'error',
      message: 'Paste the key first.',
    })
    expect(checkKeyFormat('gemini', 'AQ.Abc')?.level).toBe('error')
    expect(checkKeyFormat('gemini', 'x'.repeat(500))?.level).toBe('error')
  })

  it('mentions a key from another company without refusing it', () => {
    for (const foreign of [`sk-ant-api03-${'x'.repeat(40)}`, `sk-proj-${'x'.repeat(40)}`]) {
      const check = checkKeyFormat('gemini', foreign)
      expect(check?.level).toBe('hint')
      // Still connectable: the person in front of the screen may know
      // something this function does not.
      expect(check?.level).not.toBe('error')
    }
    expect(checkKeyFormat('gemini', `sk-ant-api03-${'x'.repeat(40)}`)?.message).toContain(
      'Anthropic',
    )
  })

  it('offers exactly one provider, and one a browser can reach', () => {
    /*
     * Gemini alone. Claude was offered too and was removed: it needed a
     * payment card before it would answer, and two options turned the first
     * screen into a decision rather than an instruction.
     *
     * ChatGPT was never here: api.openai.com sends no CORS header, so the
     * request never leaves the browser. If someone re-adds either without
     * reading the note at the top of providers.ts, this fails and explains
     * itself.
     */
    expect(PROVIDERS.map((provider) => provider.id)).toEqual(['gemini'])
    expect(isProviderId('gemini')).toBe(true)
    expect(isProviderId('claude')).toBe(false)
  })
})

describe('asking Gemini for words', () => {
  it('uses the Interactions API with a stable Flash model', async () => {
    mocks.create.mockResolvedValue(reply('I am steady.'))

    const result = await ask(AUTH_KEY, 'write me a line')

    expect(result).toEqual({ text: 'I am steady.', model: 'gemini-3.6-flash' })
    const [params, options] = mocks.create.mock.calls[0]
    expect(params.model).toBe('gemini-3.6-flash')
    expect(params.input).toBe('write me a line')
    expect(params.system_instruction).toContain('affirmations')
    // Nothing about a private ritual should sit in a history on Google's side.
    expect(params.store).toBe(false)
    expect(options.signal).toBeInstanceOf(AbortSignal)
    // Retries are the app's decision, not a silent SDK one — they spend the
    // same thirty seconds the person is sitting through.
    expect(options.maxRetries).toBe(0)
  })

  it('starts from the model that worked last time', async () => {
    mocks.create.mockResolvedValue(reply('I am here.'))

    const result = await ask(AUTH_KEY, 'hello', 'gemini-flash-lite-latest')

    expect(result.model).toBe('gemini-flash-lite-latest')
    expect(mocks.create).toHaveBeenCalledTimes(1)
  })

  it('reads text out of a response shaped in an unfamiliar way', () => {
    expect(readInteractionText(reply('  I am calm.  '))).toBe('I am calm.')
    expect(
      readInteractionText({
        steps: [{ content: [{ parts: [{ text: 'I am calm.' }, { text: 'I am rested.' }] }] }],
      }),
    ).toBe('I am calm.\nI am rested.')
    expect(readInteractionText({ nothing: true })).toBe('')
    expect(readInteractionText(null)).toBe('')
    expect(readInteractionText(undefined)).toBe('')
  })

  it('treats an empty reply as a failure rather than a silent no-op', async () => {
    mocks.create.mockResolvedValue(reply(''))
    const failure = await askForFailure(AUTH_KEY)
    expect(failure.kind).toBe('empty')
    expect(failure.message).toMatch(/untouched/i)
  })

  it('treats a malformed reply the same way', async () => {
    mocks.create.mockResolvedValue({ unexpected: 'shape' })
    expect((await askForFailure(AUTH_KEY)).kind).toBe('empty')
  })

  it('says so when a reply was held back rather than simply missing', async () => {
    mocks.create.mockResolvedValue({ output_text: '', steps: [{ status: 'BLOCKED_SAFETY' }] })
    const failure = await askForFailure(AUTH_KEY)
    expect(failure.kind).toBe('empty')
    expect(failure.message).toMatch(/held that one back/i)
  })

  it('counts a silent but successful reply as a working connection', async () => {
    // Connecting asks "will this key authenticate", not "can it write".
    mocks.create.mockResolvedValue(reply(''))
    await expect(
      verifyConnection('gemini', AUTH_KEY, withTimeout().signal),
    ).resolves.toEqual({ model: 'gemini-3.6-flash' })
  })
})

describe('telling one Gemini failure from another', () => {
  it('reads a rejected key out of Google’s 400, not out of the prefix', async () => {
    mocks.create.mockRejectedValue(
      googleError(400, detail(400, 'API key not valid. Please pass a valid API key.', {
        details: [{ reason: 'API_KEY_INVALID' }],
      })),
    )

    const failure = await askForFailure(AUTH_KEY)
    expect(failure.kind).toBe('auth')
    expect(failure.status).toBe(400)
    expect(failure.message).toMatch(/did not accept that key/i)
    expect(failure.message).not.toMatch(/AIza/)
    // A refused key fails the same way on every model; do not try four times.
    expect(mocks.create).toHaveBeenCalledTimes(1)
  })

  it('reads a rejected key out of a 401', async () => {
    mocks.create.mockRejectedValue(googleError(401, detail(401, 'Unauthenticated.')))
    const failure = await askForFailure(AUTH_KEY)
    expect(failure.kind).toBe('auth')
    expect(failure.retryable).toBe(false)
  })

  it('separates "not allowed" from "not valid" on a 403', async () => {
    mocks.create.mockRejectedValue(
      googleError(403, detail(403, 'The caller does not have permission.')),
    )
    const failure = await askForFailure(AUTH_KEY)
    expect(failure.kind).toBe('permission')
    expect(failure.message).toMatch(/recognised that key/i)
  })

  it('names the fix when the API is switched off for the project', async () => {
    mocks.create.mockRejectedValue(
      googleError(
        403,
        detail(403, 'Generative Language API has not been used in project 12345 before.', {
          details: [{ reason: 'SERVICE_DISABLED' }],
        }),
      ),
    )
    const failure = await askForFailure(AUTH_KEY)
    expect(failure.kind).toBe('permission')
    expect(failure.message).toMatch(/enable the Gemini API/i)
  })

  it('separates a switched-off key from a switched-off API', async () => {
    // Both say "disabled". Only one of them is the person's key, and sending
    // somebody into Google Cloud to enable an API they already have on is a
    // twenty-minute detour away from the actual fix.
    mocks.create.mockRejectedValue(
      googleError(403, detail(403, 'API key is disabled. Please use a valid API key.')),
    )
    const failure = await askForFailure(AUTH_KEY)
    expect(failure.kind).toBe('auth')
    expect(failure.message).toMatch(/turned off or deleted/i)
  })

  it('names the fix when a project needs a billing account', async () => {
    mocks.create.mockRejectedValue(
      googleError(403, detail(403, 'This API method requires billing to be enabled.')),
    )
    const failure = await askForFailure(AUTH_KEY)
    expect(failure.kind).toBe('billing')
    expect(failure.message).toMatch(/billing account/i)
  })

  it('names the fix when the key is restricted to other websites', async () => {
    mocks.create.mockRejectedValue(
      googleError(403, detail(403, 'Requests from referer https://example.test/ are blocked.')),
    )
    const failure = await askForFailure(AUTH_KEY)
    expect(failure.kind).toBe('permission')
    expect(failure.message).toMatch(/allowed websites/i)
  })

  it('calls a 429 a quota problem and says it will pass', async () => {
    mocks.create.mockRejectedValue(googleError(429, detail(429, 'Resource has been exhausted.')))
    const failure = await askForFailure(AUTH_KEY)
    expect(failure.kind).toBe('quota')
    expect(failure.retryable).toBe(true)
    expect(failure.message).toMatch(/wait a minute/i)
  })

  it('calls a 500 a Google problem, not a user problem', async () => {
    mocks.create.mockRejectedValue(googleError(503, detail(503, 'The model is overloaded.')))
    const failure = await askForFailure(AUTH_KEY)
    expect(failure.kind).toBe('service')
    expect(failure.message).toMatch(/untouched/i)
  })

  it('calls a blocked fetch a network problem', async () => {
    // What a browser throws when it cannot make the request at all: no
    // connection, DNS, or a CORS preflight that never came back.
    mocks.create.mockRejectedValue(new TypeError('Failed to fetch'))
    const failure = await askForFailure(AUTH_KEY)
    expect(failure.kind).toBe('network')
    expect(failure.message).toMatch(/could not reach google/i)
    expect(mocks.create).toHaveBeenCalledTimes(1)
  })

  it('stops a request that runs past the deadline, and says which it was', async () => {
    mocks.create.mockImplementation(respondsToAbort())

    const { signal, done } = withTimeout(undefined, 20)
    try {
      await askProvider('gemini', AUTH_KEY, 'hello', signal)
      throw new Error('Expected a timeout.')
    } catch (error) {
      expect((error as AiFailure).kind).toBe('timeout')
      expect((error as AiFailure).message).toMatch(/30 seconds|took longer/i)
    } finally {
      done()
    }
  })

  it('tells a deliberate stop apart from a timeout', async () => {
    mocks.create.mockImplementation(respondsToAbort())

    const { signal, cancel, done } = withTimeout(undefined, 5_000)
    const pending = askProvider('gemini', AUTH_KEY, 'hello', signal)
    cancel()
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' })
    done()
  })

  it('trusts the signal over whatever the SDK calls the resulting error', async () => {
    /*
     * Measured, not imagined. Google's client does not always surface an
     * abort as an abort: it wraps the signal's own reason and rethrows it as
     * `UnexpectedClientError`, which matches none of the usual names. Read
     * that as an unknown failure and the offline helper rewrites the draft of
     * somebody who just pressed Stop asking for nothing to happen.
     */
    mocks.create.mockImplementation((_params: unknown, options: { signal: AbortSignal }) =>
      new Promise<never>((_resolve, reject) => {
        const fail = () => {
          const wrapped = new Error('Unexpected HTTP client error: AbortError: Stopped.')
          wrapped.name = 'UnexpectedClientError'
          reject(wrapped)
        }
        if (options.signal.aborted) fail()
        else options.signal.addEventListener('abort', fail, { once: true })
      }),
    )

    const { signal, cancel } = withTimeout(undefined, 5_000)
    const pending = askProvider('gemini', AUTH_KEY, 'hello', signal)
    cancel()
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' })

    const timed = withTimeout(undefined, 20)
    await expect(askProvider('gemini', AUTH_KEY, 'hello', timed.signal)).rejects.toMatchObject({
      kind: 'timeout',
    })
    timed.done()
  })

  it('names the abort reason the way every layer beneath expects', () => {
    // `fetch` rejects with the signal's reason verbatim, and both SDKs
    // recognise an abort by this name and no other.
    expect(new AbortCause('timeout').name).toBe('AbortError')
    expect(new AbortCause('cancelled').name).toBe('AbortError')
  })

  it('does not leave a listener behind on the caller’s signal', () => {
    const outer = new AbortController()
    const removals: unknown[] = []
    const original = outer.signal.removeEventListener.bind(outer.signal)
    outer.signal.removeEventListener = ((...args: [string, EventListener]) => {
      removals.push(args[0])
      return original(...args)
    }) as typeof outer.signal.removeEventListener

    const { done } = withTimeout(outer.signal)
    done()

    expect(removals).toContain('abort')
  })
})

describe('walking down to a model the account can actually have', () => {
  it('moves on when a model is not available, and reports which one answered', async () => {
    const missing = googleError(404, detail(404, 'models/gemini-3.6-flash is not found for API version v1.'))
    mocks.create
      .mockRejectedValueOnce(missing)
      .mockRejectedValueOnce(missing)
      .mockResolvedValueOnce(reply('I am steady.'))

    const result = await ask(AUTH_KEY)

    expect(result.model).toBe('gemini-flash-lite-latest')
    expect(mocks.create).toHaveBeenCalledTimes(3)
  })

  it('moves on when one model’s allowance is spent', async () => {
    mocks.create
      .mockRejectedValueOnce(googleError(429, detail(429, 'Quota exceeded for gemini-3.6-flash.')))
      .mockResolvedValueOnce(reply('I am rested.'))

    const result = await ask(AUTH_KEY)

    expect(result.model).toBe('gemini-flash-latest')
  })

  it('moves on when an older model rejects a newer generation setting', async () => {
    // The failure that most deserves not to be blamed on somebody's key.
    mocks.create
      .mockRejectedValueOnce(
        googleError(400, detail(400, 'Invalid JSON payload received. Unknown name "thinking_level".')),
      )
      .mockResolvedValueOnce(reply('I am here.'))

    expect((await ask(AUTH_KEY)).model).toBe('gemini-flash-latest')
  })

  it('sends the newer settings only to the models that understand them', async () => {
    mocks.create
      .mockRejectedValueOnce(googleError(404, detail(404, 'not found for API version')))
      .mockRejectedValueOnce(googleError(404, detail(404, 'not found for API version')))
      .mockResolvedValueOnce(reply('I am calm.'))

    await ask(AUTH_KEY)

    const [first] = mocks.create.mock.calls[0]
    const [third] = mocks.create.mock.calls[2]
    expect(first.generation_config.thinking_level).toBe('low')
    expect(third.generation_config).not.toHaveProperty('thinking_level')
  })

  it('gives up honestly when no model is available', async () => {
    mocks.create.mockRejectedValue(googleError(404, detail(404, 'is not found for API version v1.')))

    const failure = await askForFailure(AUTH_KEY)

    expect(failure.kind).toBe('model')
    expect(mocks.create).toHaveBeenCalledTimes(findProvider('gemini').attempts.length)
    expect(failure.message).toMatch(/that key works/i)
  })

  it('reports quota, not a missing model, when every model is rate limited', async () => {
    mocks.create.mockRejectedValue(googleError(429, detail(429, 'Resource exhausted.')))
    expect((await askForFailure(AUTH_KEY)).kind).toBe('quota')
  })
})

describe('the two helper buttons, end to end', () => {
  const credentials: Credentials = {
    provider: 'gemini',
    key: AUTH_KEY,
    agreedAt: 1,
    model: 'gemini-3.6-flash',
  }

  const draft = 'I am steady before meetings.\nI trust the way I see things.'

  it('adds lines built on the draft, stripped of everything but the words', async () => {
    mocks.create.mockResolvedValue(
      reply('Here are three lines:\n1. I speak at my own pace.\n2. **I am allowed to pause.**\n- I say the hard thing kindly.'),
    )

    const result = await aiAddToWords(draft, 'Steadiness', credentials, withTimeout().signal)

    expect(result.changed).toBe(true)
    expect(result.text.startsWith(draft)).toBe(true)
    expect(result.text.split('\n').slice(2)).toEqual([
      'I speak at my own pace.',
      'I am allowed to pause.',
      'I say the hard thing kindly.',
    ])
  })

  it('refuses to add a line that promises something it cannot', async () => {
    mocks.create.mockResolvedValue(
      reply('I am steady in my body.\nMy illness is gone for good.\nMoney is coming to me now.'),
    )

    const result = await aiAddToWords(draft, '', credentials, withTimeout().signal)

    expect(result.text.split('\n').slice(2)).toEqual(['I am steady in my body.'])
  })

  it('leaves the draft alone when the rewrite does not line up', async () => {
    // Two lines in, three out — there is no honest way to map that back.
    mocks.create.mockResolvedValue(reply('One.\nTwo lines here.\nThree lines here.'))

    await expect(
      aiImproveWords(draft, credentials, withTimeout().signal),
    ).rejects.toMatchObject({ kind: 'empty' })
  })

  it('rewrites in place when the shape is right', async () => {
    mocks.create.mockResolvedValue(reply('I am steady before meetings.\nI trust my own read on things.'))

    const result = await aiImproveWords(draft, credentials, withTimeout().signal)

    expect(result.changed).toBe(true)
    expect(result.text).toBe('I am steady before meetings.\nI trust my own read on things.')
    expect(result.note).toMatch(/reshaped 1 line/i)
  })

  it('hands over to the offline helper when Gemini fails, keeping the words', async () => {
    mocks.create.mockRejectedValue(googleError(429, detail(429, 'Resource exhausted.')))

    const outcome = await helpWithFallback(
      () => aiAddToWords(draft, '', credentials, withTimeout().signal),
      () => ({ text: `${draft}\nI am here.`, note: 'Added a line.', changed: true }),
      'gemini',
    )

    expect(outcome.usedFallback).toBe(true)
    expect(outcome.failure?.kind).toBe('quota')
    expect(outcome.result?.text).toContain(draft)
    expect(outcome.result?.note).toMatch(/wait a minute/i)
    expect(outcome.result?.note).toMatch(/own helper wrote this one/i)
  })

  it('does nothing at all when the person pressed Stop', async () => {
    mocks.create.mockImplementation(respondsToAbort())
    const { signal, cancel } = withTimeout(undefined, 5_000)

    const pending = helpWithFallback(
      () => aiAddToWords(draft, '', credentials, signal),
      () => {
        throw new Error('The offline helper must not run after a deliberate stop.')
      },
      'gemini',
    )
    cancel()

    const outcome = await pending
    expect(outcome.result).toBeNull()
    expect(outcome.failure?.kind).toBe('cancelled')
  })
})

describe('classifying something that is not from an SDK at all', () => {
  const label = { id: 'gemini', name: 'Gemini', company: 'Google' }

  it('keeps a failure it has already classified', () => {
    const original = new AiFailure('quota', 'Slow down.', 'gemini')
    expect(classifyFailure(original, label)).toBe(original)
  })

  it('reads the reason off an aborted signal', () => {
    const controller = new AbortController()
    controller.abort(new AbortCause('timeout'))
    const failure = classifyFailure(new DOMException('Aborted', 'AbortError'), label, controller.signal)
    expect(failure.kind).toBe('timeout')
  })

  it('falls back to the message rather than inventing one', () => {
    const failure = classifyFailure(new Error('Something specific broke.'), label)
    expect(failure.kind).toBe('unknown')
    expect(failure.message).toBe('Something specific broke.')
  })
})
