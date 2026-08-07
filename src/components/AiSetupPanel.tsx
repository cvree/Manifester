import { useEffect, useRef, useState } from 'react'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import {
  forgetCredentials,
  maskKey,
  saveCredentials,
  type Credentials,
} from '../lib/ai/credentials'
import { AiFailure, classifyFailure, withTimeout } from '../lib/ai/errors'
import {
  checkKeyFormat,
  describeGeminiKeyStyle,
  findProvider,
  geminiKeyStyle,
  normaliseKey,
  providerLabel,
  PROVIDERS,
  verifyConnection,
  type Provider,
  type ProviderId,
} from '../lib/ai/providers'
import { Button } from './Button'
import { CheckIcon, ChevronIcon, SparkIcon } from './Icons'
import { Toggle } from './Toggle'

interface AiSetupPanelProps {
  credentials: Credentials | null
  onChange: (credentials: Credentials | null) => void
  /** The master switch. Off means nothing here runs and nothing is offered. */
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
}

/**
 * Setting up an API key, for someone who has never heard of one.
 *
 * The whole panel is built around one belief: the reason people never turn
 * this kind of thing on is not that it is hard, it is that nobody tells them
 * what the steps are or what it will cost. So the steps are numbered and
 * boring, the price is in cents, and what happens to their words is stated
 * before the box they would paste a key into — not in a policy behind a link.
 *
 * The second belief, learned the hard way: this panel does not get to decide
 * whether a key is valid. It looks at what was pasted only to be *helpful*,
 * and the Connect button always stays available unless the box is empty or
 * plainly truncated. The provider decides, out loud, in one real request.
 */
export function AiSetupPanel({
  credentials,
  onChange,
  enabled,
  onEnabledChange,
}: AiSetupPanelProps) {
  const [choosing, setChoosing] = useState<ProviderId | null>(null)
  /** Set while swapping the key on an already-connected provider. */
  const [replacing, setReplacing] = useState(false)

  const master = (
    <Toggle
      label="AI writing help"
      description={
        enabled
          ? credentials
            ? `The two helper buttons use ${findProvider(credentials.provider).name}.`
            : 'Connect a provider below, or leave this off and keep the built-in helper.'
          : 'Off. Both helper buttons use the built-in offline version, and nothing is sent anywhere.'
      }
      checked={enabled}
      onChange={(next) => {
        cue('tap')
        onEnabledChange(next)
      }}
    />
  )

  /*
   * Off hides the whole apparatus, not just the calls. Someone who has decided
   * they do not want this should not keep being shown a menu of providers —
   * and if a key is already stored it stays stored, so turning it back on is
   * one tap rather than a second setup.
   */
  if (!enabled) {
    return (
      <div className="space-y-5">
        {master}
        <p className="type-body">
          Manifester is doing the writing itself: present tense, first person,
          and the thing you want rather than the thing you are avoiding. It
          works offline and costs nothing.
        </p>
        {credentials && (
          <p className="type-meta">
            Your {findProvider(credentials.provider).name} key is still saved
            and unused. Turn this back on to use it again, or open it while on
            to remove it.
          </p>
        )}
      </div>
    )
  }

  if (credentials && !replacing) {
    return (
      <div className="space-y-5">
        {master}
        <ConnectedState
          credentials={credentials}
          onUpdate={onChange}
          onReplace={() => {
            cue('tap')
            setReplacing(true)
          }}
          onForget={async () => {
            cue('tap')
            await forgetCredentials()
            onChange(null)
            setChoosing(null)
            setReplacing(false)
          }}
        />
      </div>
    )
  }

  const setupFor = replacing ? credentials?.provider ?? null : choosing

  if (!setupFor) {
    return (
      <div className="space-y-5">
        {master}
        <Explainer />
        <div>
          <p className="type-label mb-3">Pick one</p>
          <div className="space-y-2.5">
            {PROVIDERS.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onClick={() => {
                  cue('select')
                  setChoosing(provider.id)
                }}
              />
            ))}
          </div>
        </div>
        <p className="type-meta">
          You can change or remove this at any time, and everything keeps working
          without it.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {master}
      <SetupForm
        provider={findProvider(setupFor)}
        replacing={replacing}
        onBack={() => {
          cue('tap')
          setChoosing(null)
          setReplacing(false)
        }}
        onConnected={(next) => {
          onChange(next)
          setChoosing(null)
          setReplacing(false)
        }}
      />
    </div>
  )
}

/**
 * The paste box, and the one request that decides whether it worked.
 *
 * Nothing is saved on the way in. The key lives in component state until a
 * real call to the provider has come back successfully, and only then is it
 * written to this device — so a mistyped key never becomes a stored key, and
 * on the Replace path the working key that is already there survives an
 * unsuccessful attempt at a new one.
 */
function SetupForm({
  provider,
  replacing,
  onBack,
  onConnected,
}: {
  provider: Provider
  replacing: boolean
  onBack: () => void
  onConnected: (credentials: Credentials) => void
}) {
  const [key, setKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [failure, setFailure] = useState<AiFailure | null>(null)
  /** Guards against a double tap on a slow phone getting two requests away. */
  const inFlight = useRef(false)
  const abort = useRef<(() => void) | null>(null)

  // A request must not outlive the panel that started it.
  useEffect(() => () => abort.current?.(), [])

  const check = key ? checkKeyFormat(provider.id, key) : null
  const blocked = check?.level === 'error'
  const styleNote =
    provider.id === 'gemini' && normaliseKey(key).length >= 8
      ? describeGeminiKeyStyle(geminiKeyStyle(key))
      : null

  const connect = async () => {
    if (inFlight.current) return
    const trimmed = normaliseKey(key)
    const complaint = checkKeyFormat(provider.id, trimmed)
    if (complaint?.level === 'error') {
      setFailure(new AiFailure('request', complaint.message, provider.id))
      cue('error')
      return
    }

    inFlight.current = true
    setTesting(true)
    setFailure(null)

    const { signal, cancel, done } = withTimeout()
    abort.current = cancel
    try {
      // One tiny real request. This — and nothing about how the key looks —
      // is what the word "Connected" is allowed to mean.
      const { model } = await verifyConnection(provider.id, trimmed, signal)
      const next: Credentials = {
        provider: provider.id,
        key: trimmed,
        agreedAt: Date.now(),
        model,
        verifiedAt: Date.now(),
      }
      await saveCredentials(next)
      cue('complete')
      onConnected(next)
    } catch (caught) {
      setFailure(classifyFailure(caught, providerLabel(provider.id), signal))
      cue('error')
    } finally {
      done()
      abort.current = null
      inFlight.current = false
      setTesting(false)
    }
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="interactive -ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-[0.9rem] text-ink-muted hover:text-ink"
      >
        <ChevronIcon className="rotate-90 text-[0.95rem]" aria-hidden="true" />
        {replacing ? 'Back — keep the key I have' : 'Back to the options'}
      </button>

      <div>
        <h3 className="type-subheading">
          {replacing ? `Replace your ${provider.name} key` : `Setting up ${provider.name}`}
        </h3>
        <p className="type-meta mt-1">{provider.cost}</p>
      </div>

      {replacing && (
        <p className="type-body">
          The key you have now keeps working until a new one has been checked.
          If this does not go through, nothing changes.
        </p>
      )}

      <ol className="space-y-3">
        {provider.steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--quiet)] text-[0.78rem] font-semibold tabular-nums text-ink-muted"
            >
              {index + 1}
            </span>
            <span className="text-[0.93rem] leading-relaxed text-ink">{step}</span>
          </li>
        ))}
      </ol>

      <a
        href={provider.consoleUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="interactive surface-control flex min-h-[3.25rem] w-full items-center justify-center gap-2 px-4 text-[0.95rem] font-medium text-ink"
      >
        Open the {provider.company} key page
      </a>

      <PrivacyNote provider={provider} />

      <div>
        <label htmlFor="ai-key" className="type-label mb-2.5 block">
          Paste the key here
        </label>
        <input
          id="ai-key"
          type="password"
          value={key}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={provider.keyExample}
          aria-invalid={failure ? true : undefined}
          aria-describedby="ai-key-help"
          onChange={(event) => {
            // Trimmed as it arrives. A key pasted with a trailing newline or a
            // line break in the middle is the commonest reason a good key gets
            // refused, and nothing legitimate contains whitespace.
            setKey(normaliseKey(event.target.value))
            setFailure(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !testing && key) void connect()
          }}
          className="min-h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] px-4 font-mono text-[0.95rem] text-ink transition-colors focus:border-[var(--border-strong)]"
        />

        <div id="ai-key-help" className="space-y-2">
          {failure ? (
            <p
              role="alert"
              className="mt-2.5 text-[0.88rem] leading-relaxed text-[var(--rose-deep)]"
            >
              {failure.message}
            </p>
          ) : (
            <>
              {check && (
                <p
                  role="status"
                  className={cx(
                    'mt-2.5 text-[0.88rem] leading-relaxed',
                    check.level === 'error' ? 'text-[var(--rose-deep)]' : 'text-ink-muted',
                  )}
                >
                  {check.message}
                </p>
              )}
              {styleNote && !check && (
                <p role="status" className="mt-2.5 text-[0.88rem] leading-relaxed text-ink-muted">
                  {styleNote}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="primary"
          size="lg"
          block={!testing}
          className={testing ? 'grow' : undefined}
          loading={testing}
          disabled={!key || blocked}
          onClick={() => void connect()}
        >
          {testing ? 'Checking the key…' : 'Connect'}
        </Button>
        {testing && (
          <Button size="lg" variant="ghost" onClick={() => abort.current?.()}>
            Stop
          </Button>
        )}
      </div>

      <p className="type-meta">
        Connecting sends one very short test message to {provider.company} to
        check the key really works. Nothing you have written is included, and
        the key is only saved once that message comes back.
      </p>
    </div>
  )
}

function Explainer() {
  return (
    <div className="space-y-3">
      <p className="type-body">
        Manifester can borrow an AI to write with you. It makes{' '}
        <em className="not-italic text-ink">Add to my words</em> and{' '}
        <em className="not-italic text-ink">Improve my words</em> noticeably
        better — the suggestions are built around what you actually wrote
        instead of chosen from a built-in list, and they never run out.
      </p>
      <p className="type-body">
        It needs a key from one of two companies. A key is a long password that
        lets this app use your account. Getting one takes about two minutes.
      </p>
    </div>
  )
}

function ProviderCard({
  provider,
  onClick,
}: {
  provider: Provider
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'interactive group flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left',
        'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]',
      )}
    >
      <span className="min-w-0 grow">
        <span className="block text-[1rem] font-medium text-ink">
          {provider.name}
          <span className="ml-2 text-[0.82rem] font-normal text-ink-faint">
            by {provider.company}
          </span>
        </span>
        <span className="mt-1 block text-[0.88rem] leading-relaxed text-ink-muted">
          {provider.blurb}
        </span>
        <span className="mt-1.5 block text-[0.82rem] text-ink-faint">
          {provider.cost}
        </span>
      </span>
      <ChevronIcon
        aria-hidden="true"
        className="shrink-0 -rotate-90 text-[1.05rem] text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5"
      />
    </button>
  )
}

/**
 * The one screen where "free" needs an asterisk.
 *
 * Gemini's free tier is genuinely free of money and not free of privacy:
 * Google's API terms say it uses unpaid-tier content to improve its products
 * and that human reviewers may read it. For a page of somebody's private
 * affirmations that is the most important sentence in this panel, so it is
 * styled as a warning rather than tucked into small print.
 */
function PrivacyNote({ provider }: { provider: Provider }) {
  return (
    <div
      className={cx(
        'rounded-2xl border px-4 py-3.5',
        provider.humanReview
          ? 'border-[var(--gold)] bg-[var(--gold-soft)]'
          : 'border-[var(--border)] bg-[var(--surface-sunken)]',
      )}
    >
      <p className="type-label mb-1.5">
        {provider.humanReview ? 'Please read this one' : 'What happens to your words'}
      </p>
      <p className="text-[0.9rem] leading-relaxed text-ink">{provider.privacy}</p>
      <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-muted">
        Either way: your loop is sent to {provider.company} only when you press
        one of the two helper buttons, never while you write and never during a
        session. Manifester has no server and keeps no copy.
      </p>
    </div>
  )
}

/**
 * What is connected, and the three things anybody ever wants to do about it.
 *
 * The model is named rather than implied. "Gemini is connected" is not quite
 * the truth when four different Gemini models might have answered — and when
 * a fallback has quietly moved somebody onto a lighter one, being told so is
 * the difference between a mystery and a fact.
 */
function ConnectedState({
  credentials,
  onUpdate,
  onReplace,
  onForget,
}: {
  credentials: Credentials
  onUpdate: (credentials: Credentials) => void
  onReplace: () => void
  onForget: () => Promise<void>
}) {
  const provider = findProvider(credentials.provider)
  const [confirming, setConfirming] = useState(false)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const inFlight = useRef(false)
  const abort = useRef<(() => void) | null>(null)

  useEffect(() => () => abort.current?.(), [])

  const test = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setTesting(true)
    setResult(null)

    const { signal, cancel, done } = withTimeout()
    abort.current = cancel
    try {
      const { model } = await verifyConnection(credentials.provider, credentials.key, signal)
      const next: Credentials = { ...credentials, model, verifiedAt: Date.now() }
      await saveCredentials(next)
      onUpdate(next)
      cue('complete')
      setResult({ ok: true, message: `Answered just now, using ${model}.` })
    } catch (caught) {
      const failure = classifyFailure(caught, providerLabel(credentials.provider), signal)
      cue('error')
      setResult({ ok: false, message: failure.message })
    } finally {
      done()
      abort.current = null
      inFlight.current = false
      setTesting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl border border-[var(--sage)] bg-[var(--sage-soft)] px-4 py-3.5"
      >
        <CheckIcon aria-hidden="true" className="mt-0.5 shrink-0 text-[1.05rem] text-ink" />
        <div className="min-w-0">
          <p className="text-[0.95rem] font-medium text-ink">
            {provider.name} is connected
          </p>
          <p className="mt-0.5 font-mono text-[0.82rem] break-all text-ink-muted">
            {maskKey(credentials.key)}
          </p>
          <p className="mt-1 text-[0.82rem] leading-relaxed text-ink-muted">
            {credentials.model ? (
              <>
                Writing with <span className="font-mono">{credentials.model}</span>.{' '}
              </>
            ) : null}
            {describeVerified(credentials.verifiedAt)}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <SparkIcon aria-hidden="true" className="mt-1 shrink-0 text-[1rem] text-ink-muted" />
        <p className="type-body">
          <em className="not-italic text-ink">Add to my words</em> and{' '}
          <em className="not-italic text-ink">Improve my words</em> on the Create
          screen now use {provider.name}. If it is ever unreachable they fall
          back to the built-in helper, so they always do something.
        </p>
      </div>

      <PrivacyNote provider={provider} />

      <p className="type-meta">
        {provider.cost} Watch your usage in your {provider.company} account.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="md" loading={testing} onClick={() => void test()}>
          {testing ? 'Testing…' : 'Test connection'}
        </Button>
        {testing ? (
          <Button size="md" variant="ghost" onClick={() => abort.current?.()}>
            Stop
          </Button>
        ) : (
          <Button size="md" variant="ghost" onClick={onReplace}>
            Replace key
          </Button>
        )}
      </div>

      {result && (
        <p
          role="status"
          className={cx(
            'text-[0.88rem] leading-relaxed',
            result.ok ? 'text-ink' : 'text-[var(--rose-deep)]',
          )}
        >
          {result.message}
        </p>
      )}

      {confirming ? (
        <div className="space-y-2.5">
          <p className="text-[0.92rem] leading-relaxed text-ink">
            Remove the key from this device? The two helper buttons go back to
            the built-in offline version.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" size="md" onClick={() => void onForget()}>
              Disconnect and forget it
            </Button>
            <Button variant="ghost" size="md" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="md" onClick={() => setConfirming(true)}>
          Disconnect
        </Button>
      )}
    </div>
  )
}

/** "Checked 20 minutes ago" beats a timestamp nobody wants to read. */
function describeVerified(at?: number): string {
  if (!at) return 'Not checked since this device stored it.'
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60_000))
  if (minutes < 1) return 'Checked just now.'
  if (minutes < 60) return `Checked ${minutes} minute${minutes === 1 ? '' : 's'} ago.`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Checked ${hours} hour${hours === 1 ? '' : 's'} ago.`
  const days = Math.round(hours / 24)
  return `Checked ${days} day${days === 1 ? '' : 's'} ago.`
}

/** The one-line state for the Customize list. */
export function aiSummary(
  credentials: Credentials | null,
  enabled: boolean,
): string {
  if (!enabled) return 'Off — using the built-in helper'
  if (!credentials) return 'Not connected — using the built-in helper'
  return `${findProvider(credentials.provider).name} · ${maskKey(credentials.key)}`
}
