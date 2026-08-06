import { useState } from 'react'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import {
  forgetCredentials,
  maskKey,
  saveCredentials,
  type Credentials,
} from '../lib/ai/credentials'
import { withTimeout } from '../lib/ai/enhance'
import {
  askProvider,
  findProvider,
  keyLooksWrong,
  PROVIDERS,
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
 */
export function AiSetupPanel({
  credentials,
  onChange,
  enabled,
  onEnabledChange,
}: AiSetupPanelProps) {
  const [choosing, setChoosing] = useState<ProviderId | null>(null)
  const [key, setKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  if (credentials) {
    return (
      <div className="space-y-5">
        {master}
        <ConnectedState
          credentials={credentials}
          onForget={async () => {
            cue('tap')
            await forgetCredentials()
            onChange(null)
            setChoosing(null)
            setKey('')
          }}
        />
      </div>
    )
  }

  if (!choosing) {
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
                  setError(null)
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

  const provider = findProvider(choosing)

  const connect = async () => {
    const complaint = keyLooksWrong(provider.id, key)
    if (complaint) {
      setError(complaint)
      cue('error')
      return
    }

    setTesting(true)
    setError(null)
    const { signal, done } = withTimeout()
    try {
      // Spend one tiny request proving the key works, so nobody discovers it
      // was pasted wrong halfway through writing something.
      await askProvider(provider.id, key.trim(), 'Reply with the single word: ready', signal)
      const next: Credentials = {
        provider: provider.id,
        key: key.trim(),
        agreedAt: Date.now(),
      }
      await saveCredentials(next)
      cue('complete')
      onChange(next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      cue('error')
    } finally {
      done()
      setTesting(false)
    }
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => {
          cue('tap')
          setChoosing(null)
          setError(null)
        }}
        className="interactive -ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-[0.9rem] text-ink-muted hover:text-ink"
      >
        <ChevronIcon className="rotate-90 text-[0.95rem]" />
        All three options
      </button>

      <div>
        <h3 className="type-subheading">
          Setting up {provider.name}
        </h3>
        <p className="type-meta mt-1">{provider.cost}</p>
      </div>

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
        <label
          htmlFor="ai-key"
          className="type-label mb-2.5 block"
        >
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
          onChange={(event) => {
            setKey(event.target.value)
            setError(null)
          }}
          className="min-h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] px-4 font-mono text-[0.95rem] text-ink transition-colors focus:border-[var(--border-strong)]"
        />
        {error && (
          <p role="alert" className="mt-2.5 text-[0.88rem] leading-relaxed text-[var(--rose-deep)]">
            {error}
          </p>
        )}
      </div>

      <Button
        variant="primary"
        size="lg"
        block
        loading={testing}
        disabled={!key.trim()}
        onClick={() => void connect()}
      >
        {testing ? 'Checking the key…' : 'Connect'}
      </Button>

      <p className="type-meta">
        Connecting sends one very short test message to {provider.company} to
        check the key works. Nothing you have written is included.
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
        It needs a key from one of three companies. A key is a long password
        that lets this app use your account. Getting one takes about two
        minutes.
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

function ConnectedState({
  credentials,
  onForget,
}: {
  credentials: Credentials
  onForget: () => Promise<void>
}) {
  const provider = findProvider(credentials.provider)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-[var(--sage)] bg-[var(--sage-soft)] px-4 py-3.5">
        <CheckIcon aria-hidden="true" className="mt-0.5 shrink-0 text-[1.05rem] text-ink" />
        <div className="min-w-0">
          <p className="text-[0.95rem] font-medium text-ink">
            {provider.name} is connected
          </p>
          <p className="mt-0.5 font-mono text-[0.82rem] break-all text-ink-muted">
            {maskKey(credentials.key)}
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

      {confirming ? (
        <div className="space-y-2.5">
          <p className="text-[0.92rem] leading-relaxed text-ink">
            Remove the key from this device? The two helper buttons go back to
            the built-in offline version.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" size="md" onClick={() => void onForget()}>
              Forget this key
            </Button>
            <Button variant="ghost" size="md" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="md" onClick={() => setConfirming(true)}>
          Forget this key
        </Button>
      )}
    </div>
  )
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
