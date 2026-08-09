import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import { useIsCompact, useReducedMotion } from '../lib/motion'
import { useSession } from '../state/SessionProvider'
import { useStage } from '../state/StageProvider'
import { useTheme } from '../state/ThemeProvider'
import { CosmicBackground } from './CosmicBackground'
import {
  BloomIcon,
  ChevronIcon,
  InfoIcon,
  LeafIcon,
  MoonIcon,
  PauseIcon,
  PlayIcon,
  SparkIcon,
  SunIcon,
} from './Icons'
import { InstallPrompt } from './InstallPrompt'

/**
 * Three tabs, in the order the app is used: write it, play it, keep it.
 * Saved loops and sounds were two separate destinations answering the same
 * question, and they share one library now.
 */
const TABS = [
  { to: '/create', label: 'Create', icon: BloomIcon },
  { to: '/player', label: 'Player', icon: PlayIcon },
  { to: '/library', label: 'Library', icon: LeafIcon },
]

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme, nightLight } = useTheme()
  const { session, pause, resume } = useSession()
  const { expanded: stageExpanded } = useStage()
  const reducedMotion = useReducedMotion()
  const compact = useIsCompact()
  const mainRef = useRef<HTMLElement>(null)
  const [navRevealed, setNavRevealed] = useState(false)

  const isPlaying = session.status === 'playing'
  const hasSession = session.status !== 'idle'
  const onPlayer = location.pathname === '/player'
  const showMiniPlayer = hasSession && !onPlayer

  /*
   * Immersive mode: on a phone, while a session is actually running on the
   * player, the chrome slides out of the way so the screen is just the
   * ritual. A strip along the bottom edge brings it straight back — the app
   * never traps anyone on a screen. It stays off on desktop, where the header
   * holds the only navigation there is.
   */
  const immersive = compact && isPlaying && onPlayer && !navRevealed

  /*
   * Expanding the player's stage does the same thing on every size of screen,
   * and for the same reason — except there the way back is the collapse
   * control on the stage itself, and Escape, so the chrome can go on a desktop
   * too without stranding anyone.
   */
  const chromeHidden = immersive || stageExpanded

  // Any route change, or ending the session, restores the normal chrome.
  useEffect(() => setNavRevealed(false), [location.pathname])

  // A gentle stagger as each screen arrives. Skipped when motion is reduced.
  useGSAP(
    () => {
      if (reducedMotion) return
      const targets = mainRef.current?.querySelectorAll('[data-rise]')
      // A redirect route renders nothing to animate on the very first pass.
      if (!targets || targets.length === 0) return
      gsap.from(targets, {
        opacity: 0,
        y: 18,
        duration: 0.6,
        ease: 'power2.out',
        stagger: 0.07,
        clearProps: 'opacity,transform',
      })
    },
    { scope: mainRef, dependencies: [location.pathname, reducedMotion] },
  )

  return (
    <div className="relative flex min-h-dvh flex-col">
      {/* The garden warms while a session runs, and again while it is all
          there is on screen. */}
      <CosmicBackground active={isPlaying || stageExpanded} />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-[1rem] focus:bg-[var(--panel-solid)] focus:px-4 focus:py-2.5 focus:text-ink"
      >
        Skip to content
      </a>

      <header
        className={cx(
          'safe-top px-4 pb-3 transition-opacity duration-500 sm:px-6 lg:px-10',
          chromeHidden && 'pointer-events-none opacity-0',
        )}
        inert={chromeHidden}
        aria-hidden={chromeHidden || undefined}
      >
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4">
          <NavLink
            to="/create"
            className="group flex shrink-0 items-center gap-2.5 rounded-2xl py-1 pr-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)] text-[1.05rem] text-[var(--rose-deep)]">
              <SparkIcon />
            </span>
            <span className="shimmer-ink font-display text-[1.45rem] tracking-tight">
              Manifester
            </span>
          </NavLink>

          {/* Desktop navigation. The floating bar below is phone-only. */}
          <nav aria-label="Main sections" className="hidden lg:block">
            <ul className="surface-panel flex items-center gap-1 rounded-pill p-1.5 shadow-none">
              {TABS.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={() => cue('select')}
                    className={({ isActive }) =>
                      cx(
                        'interactive flex min-h-11 items-center gap-2 rounded-pill px-4 text-[0.92rem] font-medium',
                        isActive
                          ? 'bg-[var(--rose-soft)] text-[var(--rose-deep)]'
                          : 'text-ink-muted hover:bg-[var(--quiet)] hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className="text-[1.05rem]" />
                        {label}
                        {isActive && <span className="sr-only">(current)</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => navigate('/about')}
              aria-label="About and install instructions"
              aria-current={location.pathname === '/about' ? 'page' : undefined}
              className={cx(
                'interactive flex h-11 w-11 items-center justify-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)] text-[1.05rem]',
                location.pathname === '/about'
                  ? 'text-[var(--rose-deep)]'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              <InfoIcon />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === 'day' ? 'Switch to night colours' : 'Switch to day colours'
              }
              className="interactive flex h-11 w-11 items-center justify-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)] text-[1.05rem] text-ink-muted hover:text-ink"
            >
              {theme === 'day' ? <MoonIcon /> : <SunIcon />}
            </button>
          </div>
        </div>
      </header>

      <main
        ref={mainRef}
        id="main"
        className={cx(
          'mx-auto w-full max-w-[1440px] grow px-4 sm:px-6 lg:px-10',
          // Enough room under the last element to clear the floating nav, and
          // more again when the mini-player is docked above it.
          showMiniPlayer
            ? 'pb-[calc(11rem+env(safe-area-inset-bottom))] lg:pb-32'
            : 'pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-16',
        )}
      >
        <Outlet />
      </main>

      {showMiniPlayer && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-20 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:px-0">
          <div className="surface-sheet pointer-events-auto mx-auto flex w-full max-w-md items-center gap-3 rounded-[1.25rem] px-3 py-2.5 lg:mx-0 lg:w-80">
            <button
              type="button"
              onClick={() => {
                cue('tap')
                if (isPlaying) pause()
                else resume()
              }}
              aria-label={isPlaying ? 'Pause the loop' : 'Resume the loop'}
              className="interactive flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--rose-deep)] text-[1.1rem] text-[var(--bg-0)]"
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              onClick={() => navigate('/player')}
              className="flex min-h-11 min-w-0 grow flex-col justify-center text-left"
            >
              <span className="block truncate text-[0.95rem] font-medium text-ink">
                {session.title}
              </span>
              <span className="block truncate text-[0.82rem] text-ink-muted">
                {isPlaying ? 'Looping — tap to open the player' : 'Paused'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* The phone's floating navigation. */}
      <nav
        aria-label="Main sections"
        inert={chromeHidden}
        aria-hidden={chromeHidden || undefined}
        className={cx(
          'pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 lg:hidden',
          'transition-[transform,opacity] duration-500 ease-[var(--ease-calm)]',
          chromeHidden && 'translate-y-[130%] opacity-0',
        )}
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <ul
          className={cx(
            'surface-sheet flex w-full max-w-md items-stretch gap-1 rounded-[1.5rem] p-1.5',
            chromeHidden && 'pointer-events-none',
            !chromeHidden && 'pointer-events-auto',
          )}
        >
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                onClick={() => cue('select')}
                tabIndex={chromeHidden ? -1 : undefined}
                className={({ isActive }) =>
                  cx(
                    'interactive flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-[1.15rem] px-1',
                    'text-[0.7rem] font-medium tracking-wide',
                    isActive
                      ? 'bg-[var(--rose-soft)] text-[var(--rose-deep)]'
                      : 'text-ink-faint hover:text-ink-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="text-[1.2rem]" />
                    {label}
                    {isActive && <span className="sr-only">(current)</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/*
        Bring the chrome back from immersive mode. Not while the stage is
        expanded: that has its own way out, in the corner where it belongs,
        and a second one at the bottom edge would only be a second thing to
        explain.
      */}
      {immersive && !stageExpanded && (
        <button
          type="button"
          onClick={() => {
            cue('tap')
            setNavRevealed(true)
          }}
          aria-label="Show navigation"
          className="fixed inset-x-0 bottom-0 z-30 mx-auto flex h-11 w-32 items-end justify-center pb-2 lg:hidden"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-16 items-center justify-center rounded-pill border border-[var(--panel-border)] bg-[var(--panel)] text-ink-faint backdrop-blur-lg"
          >
            <ChevronIcon className="rotate-180 text-[1rem]" />
          </span>
        </button>
      )}

      <InstallPrompt />

      {/*
        The night light: one warm pane, multiplied over everything.

        Last in the source and highest in the stack on purpose — it has to
        reach the expanded stage and the install prompt as well as the page,
        because a screen that gets warmer everywhere except the one thing you
        are looking at is worse than one that does not get warmer at all.

        Mounted only when it would do something. At zero the tint is pure
        white and multiplying by it is arithmetically a no-op, but a
        viewport-sized blended layer is not free to composite, and the great
        majority of people will never turn this on.
      */}
      {nightLight > 0 && <div aria-hidden="true" className="night-light" />}
    </div>
  )
}
