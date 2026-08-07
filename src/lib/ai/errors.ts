/**
 * What went wrong, said in a way somebody can act on.
 *
 * Every failure from either provider arrives here and leaves as an
 * `AiFailure` carrying a `kind` — so the app can decide *behaviour* from the
 * kind (fall back to the offline helper? try a different model? keep the key?)
 * and show a *message* written for a person who does not know what a 403 is.
 *
 * The distinctions are not decorative. "Wrong key", "right key, wrong
 * permissions", "right key, no quota left", "right key, that model is not
 * available to you", and "the network never let the request out" all look
 * roughly the same in a console and want five completely different actions
 * from the person sitting there.
 */

/** Just enough of a provider to write a sentence about it. */
export interface ProviderLabel {
  id: string
  name: string
  company: string
}

export type AiFailureKind =
  /** The credential itself was refused. */
  | 'auth'
  /** The credential is real but is not allowed to make this call. */
  | 'permission'
  /** Rate limit or daily allowance. */
  | 'quota'
  /** The account has no money left on it. */
  | 'billing'
  /** The requested model is not available to this account. */
  | 'model'
  /** The request was malformed — our bug, not theirs. */
  | 'request'
  /** The request never reached the provider: offline, DNS, CORS, a filter. */
  | 'network'
  /** Our own deadline ran out. */
  | 'timeout'
  /** Somebody pressed stop, or navigated away. */
  | 'cancelled'
  /** The provider is having a bad day. */
  | 'service'
  /** A 200 that contained nothing usable. */
  | 'empty'
  | 'unknown'

/** Failures worth simply trying again, unchanged. */
const RETRYABLE: ReadonlySet<AiFailureKind> = new Set<AiFailureKind>([
  'quota',
  'network',
  'timeout',
  'service',
  'empty',
])

export class AiFailure extends Error {
  readonly kind: AiFailureKind
  readonly providerId: string
  readonly status?: number
  /** True when repeating the identical request might simply work. */
  readonly retryable: boolean

  constructor(
    kind: AiFailureKind,
    message: string,
    providerId: string,
    status?: number,
  ) {
    super(message)
    this.name = 'AiFailure'
    this.kind = kind
    this.providerId = providerId
    this.status = status
    this.retryable = RETRYABLE.has(kind)
  }
}

/*
 * Cancellation, and telling the two kinds of it apart.
 *
 * A request that was stopped because our 30-second deadline expired and one
 * that was stopped because the person pressed Stop are the same `AbortError`
 * at the fetch layer, and they want opposite behaviour: the first should fall
 * back to the offline helper and apologise, the second should quietly do
 * nothing. So the abort carries a reason, and the reason is read back out.
 */
export class AbortCause extends Error {
  readonly abortKind: 'timeout' | 'cancelled'

  constructor(abortKind: 'timeout' | 'cancelled') {
    super(abortKind === 'timeout' ? 'Timed out.' : 'Stopped.')
    /*
     * `AbortError` and not `AbortCause`, even though the extra field is what
     * this class exists for.
     *
     * `fetch` rejects with the signal's reason verbatim, and every layer
     * between here and it — both SDKs, the browser — recognises an abort by
     * this exact name. Called anything else, a perfectly ordinary Stop comes
     * back through Google's client as `UnexpectedClientError`, gets classified
     * as an unknown failure, and the offline helper cheerfully rewrites the
     * draft of somebody who just asked for nothing to happen.
     */
    this.name = 'AbortError'
    this.abortKind = abortKind
  }
}

/**
 * Refuse to start work that has already been called off.
 *
 * Cheap insurance against a race nobody sees until it happens: a request whose
 * signal aborts during the dynamic `import()` of an SDK would otherwise attach
 * its listener to a signal that has already fired, and then wait for an abort
 * event that is never coming again.
 */
export function throwIfAborted(signal: AbortSignal | undefined, provider: ProviderLabel): void {
  const kind = abortKindOf(signal)
  if (kind) throw classifyFailure(new AbortCause(kind), provider, signal)
}

export function abortKindOf(signal?: AbortSignal): 'timeout' | 'cancelled' | null {
  if (!signal?.aborted) return null
  const reason: unknown = signal.reason
  if (reason instanceof AbortCause) return reason.abortKind
  // Someone else's signal, aborted for their own reasons. Treat as deliberate.
  return 'cancelled'
}

/** Long enough for a slow phone on hotel wifi, short enough to not feel stuck. */
export const TIMEOUT_MS = 30_000

export interface TimedRequest {
  signal: AbortSignal
  /** Stop the request now, as a deliberate cancellation. */
  cancel: () => void
  /** Always call this — it clears the timer and unhooks the outer signal. */
  done: () => void
}

/**
 * A deadline for one request, plus the caller's own ability to cancel it.
 *
 * The listener on the outer signal is removed in `done()`. Left attached it
 * would keep this controller — and the closure around it — alive for as long
 * as the outer signal lives, which on a long-lived component is a leak that
 * grows one entry per press.
 */
export function withTimeout(outer?: AbortSignal, ms: number = TIMEOUT_MS): TimedRequest {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new AbortCause('timeout')), ms)
  const relay = () => controller.abort(new AbortCause('cancelled'))
  outer?.addEventListener('abort', relay, { once: true })

  return {
    signal: controller.signal,
    cancel: () => controller.abort(new AbortCause('cancelled')),
    done: () => {
      clearTimeout(timer)
      outer?.removeEventListener('abort', relay)
    },
  }
}

/** Names both SDKs use for "this request was stopped". */
const ABORT_NAMES = new Set(['AbortError', 'APIUserAbortError', 'RequestAbortedError'])

const TIMEOUT_NAMES = new Set([
  'TimeoutError',
  'APIConnectionTimeoutError',
  'RequestTimeoutError',
])

function nameOf(error: unknown): string {
  return typeof (error as { name?: unknown })?.name === 'string'
    ? (error as { name: string }).name
    : ''
}

function statusOf(error: unknown): number | undefined {
  const candidate = error as { status?: unknown; statusCode?: unknown }
  if (typeof candidate?.status === 'number') return candidate.status
  if (typeof candidate?.statusCode === 'number') return candidate.statusCode
  return undefined
}

/**
 * Everything readable about a failure, as one lowercase haystack.
 *
 * Google's error detail is the part that actually says which of five very
 * different 400s and 403s this is, and depending on which layer of the SDK
 * threw, it lands on `.message`, on a parsed `.error` object, or only in the
 * raw `.body` string. Reading all three is not belt and braces — it is the
 * difference between "check your key" and "switch the API on".
 */
function haystack(error: unknown): string {
  const parts: string[] = []
  if (error instanceof Error) parts.push(error.message)
  const candidate = error as { error?: unknown; body?: unknown; cause?: unknown }

  for (const value of [candidate?.error, candidate?.body]) {
    if (typeof value === 'string') parts.push(value)
    else if (value && typeof value === 'object') {
      try {
        parts.push(JSON.stringify(value))
      } catch {
        // A body that will not serialise tells us nothing; carry on.
      }
    }
  }

  if (candidate?.cause instanceof Error) parts.push(candidate.cause.message)
  if (!parts.length) parts.push(String(error))
  return parts.join(' ').toLowerCase()
}

/** Where this page is served from, for a message about website restrictions. */
function currentOrigin(): string {
  try {
    return typeof location !== 'undefined' && location.origin ? location.origin : 'this site'
  } catch {
    return 'this site'
  }
}

/*
 * Google's machine-readable reasons, in the shapes they actually arrive in.
 * Matched against the whole haystack, so both `"reason": "API_KEY_INVALID"`
 * and the prose sentence next to it will hit.
 */
const INVALID_KEY = /api[_ -]?key[_ -]?invalid|api key not valid|invalid authentication|invalid api key|unauthenticated/
/*
 * A key that was switched off or deleted, which is a different thing from a
 * project with the API switched off — and wants a different sentence. Checked
 * first, because "disabled" appears in both and only one of them is the
 * person's key.
 */
const KEY_SWITCHED_OFF = /(api[_ -]?key|credential)s?\b[^.]{0,40}\b(disabled|expired|revoked|deleted|suspended)|key_(disabled|revoked|expired)/
const SERVICE_OFF = /service_disabled|has not been used in project|(api|service) is disabled|api_key_service_blocked|enable the (generative language|gemini) api/
/** Google asking for a billing account rather than for money already owed. */
const NEEDS_BILLING = /billing (to be enabled|is not enabled|account)|requires billing|billing_disabled/
const SITE_BLOCKED = /referer|referrer|api_key_http|requests from this (android|ios)|blocked by the api key/
const MODEL_MISSING = /not found for api version|is not found|not supported for|unsupported model|models\/[a-z0-9.-]+ (is|was) not|unknown model|no longer available|has been (deprecated|retired)/
/*
 * A 400 caused by a request field this model does not know about. Older
 * models reject the newer generation settings, and the honest response to
 * that is to try the next model rather than to blame the person's key.
 */
const UNSUPPORTED_FIELD = /unknown name|invalid json payload|cannot find field|unsupported (field|parameter)|thinking_level|generation_config/
const OUT_OF_CREDIT = /out of credit|insufficient (credit|funds|balance)|billing|payment required|credit balance is too low/
const OFFLINE = /failed to fetch|networkerror|network error|load failed|connection error|err_(network|internet|connection)|econnrefused|enotfound|socket hang up|fetch failed/

/**
 * Turn anything a provider or a browser threw into an `AiFailure`.
 *
 * `signal` is passed in so a cancelled request can say whether it was our
 * deadline or the person's own Stop — the error alone cannot tell you.
 */
export function classifyFailure(
  error: unknown,
  provider: ProviderLabel,
  signal?: AbortSignal,
): AiFailure {
  if (error instanceof AiFailure) return error

  /*
   * The signal is the authority on cancellation, ahead of anything the error
   * says. An SDK is free to wrap our abort in an error class of its own
   * choosing — and Google's does — but if this request's own signal has been
   * aborted then whatever came back is a consequence of that, not a separate
   * problem worth reporting to anybody.
   */
  const aborted = abortKindOf(signal)
  if (aborted) return aborted === 'timeout' ? timedOut(provider) : stopped(provider)

  const name = nameOf(error)
  const status = statusOf(error)
  const text = haystack(error)

  // Stopped by somebody else's signal, then: still a stop.
  if (
    error instanceof AbortCause ||
    ABORT_NAMES.has(name) ||
    // No status means nothing came back at all, so "aborted" in the text is
    // describing this request rather than quoting a provider's own wording.
    (status == null && /\baborted\b/.test(text))
  ) {
    return stopped(provider)
  }

  if (TIMEOUT_NAMES.has(name) || /timed out|timeout/.test(text)) {
    return timedOut(provider)
  }

  if (status === 401) return badKey(provider, status)

  if (status === 403) {
    if (KEY_SWITCHED_OFF.test(text)) {
      return new AiFailure(
        'auth',
        `That key has been turned off or deleted at ${provider.company}'s end. Make a fresh one on the ${provider.company} key page and paste it in — nothing else needs changing.`,
        provider.id,
        status,
      )
    }
    if (NEEDS_BILLING.test(text)) {
      return new AiFailure(
        'billing',
        `That key's Google Cloud project has no billing account attached, and this request needs one. Either attach one in Google Cloud, or make a key in a project on the free tier.`,
        provider.id,
        status,
      )
    }
    if (SERVICE_OFF.test(text)) {
      return new AiFailure(
        'permission',
        `That key is real, but the ${provider.name} API is not switched on for the Google Cloud project behind it. Open the key in Google AI Studio, enable the Gemini API for its project, then try again.`,
        provider.id,
        status,
      )
    }
    if (SITE_BLOCKED.test(text)) {
      return new AiFailure(
        'permission',
        `That key only works from certain websites, and ${currentOrigin()} is not one of them. Either add this address to the key's allowed websites, or make a key without a website restriction.`,
        provider.id,
        status,
      )
    }
    if (INVALID_KEY.test(text)) return badKey(provider, status)
    return new AiFailure(
      'permission',
      `${provider.company} recognised that key but will not let it make this request. Check the key is still enabled and is allowed to use the ${provider.name} API, then try again.`,
      provider.id,
      status,
    )
  }

  if (status === 404 || MODEL_MISSING.test(text)) return noModel(provider, status)

  if (status === 429) {
    return new AiFailure(
      'quota',
      `${provider.name} is asking you to slow down, or the day's free allowance is used up. Wait a minute and press again; if it keeps happening, it will reset within a day.`,
      provider.id,
      status,
    )
  }

  if (status === 402 || OUT_OF_CREDIT.test(text)) {
    return new AiFailure(
      'billing',
      `That ${provider.company} account has no credit left. Top it up and try again.`,
      provider.id,
      status,
    )
  }

  if (status === 400) {
    /*
     * Google answers a rejected key with 400 INVALID_ARGUMENT rather than
     * 401. It is only ever *some* 400s, though — treating all of them as a
     * bad key is how a perfectly good key gets blamed for an unsupported
     * request field, so the body is read before anyone is accused.
     */
    if (INVALID_KEY.test(text)) return badKey(provider, status)
    if (UNSUPPORTED_FIELD.test(text)) return noModel(provider, status)
    return new AiFailure(
      'request',
      `${provider.name} rejected the shape of that request. Nothing you wrote is lost. If it happens again, disconnect the key and connect it once more.`,
      provider.id,
      status,
    )
  }

  if (status != null && status >= 500) {
    return new AiFailure(
      'service',
      `${provider.name} is having trouble at its end right now. Your words are untouched — try again in a few minutes.`,
      provider.id,
      status,
    )
  }

  if (OFFLINE.test(text)) {
    return new AiFailure(
      'network',
      `Could not reach ${provider.company} from this browser. Check the connection — and note that some office, school and public networks block it outright.`,
      provider.id,
      status,
    )
  }

  if (INVALID_KEY.test(text)) return badKey(provider, status)

  return new AiFailure(
    'unknown',
    (error instanceof Error && error.message) ||
      `Something went wrong reaching ${provider.company}. Your words are untouched.`,
    provider.id,
    status,
  )
}

function badKey(provider: ProviderLabel, status?: number): AiFailure {
  return new AiFailure(
    'auth',
    `${provider.company} did not accept that key. Copy it again from the ${provider.company} key page — keys are shown once, so a partial copy is the usual cause — and check it has not been deleted or turned off.`,
    provider.id,
    status,
  )
}

function noModel(provider: ProviderLabel, status?: number): AiFailure {
  return new AiFailure(
    'model',
    `That key works, but none of the ${provider.name} models Manifester asks for are available to it right now. A brand-new key sometimes needs a few minutes; otherwise check the account still has access to the Flash models.`,
    provider.id,
    status,
  )
}

function timedOut(provider: ProviderLabel): AiFailure {
  return new AiFailure(
    'timeout',
    `${provider.name} took longer than 30 seconds, so it was stopped. Your words are untouched.`,
    provider.id,
  )
}

function stopped(provider: ProviderLabel): AiFailure {
  return new AiFailure('cancelled', 'Stopped. Your words are untouched.', provider.id)
}
