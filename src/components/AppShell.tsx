import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import { useReducedMotion } from '../lib/motion'
import { useSession } from '../state/SessionProvider'
import { useTheme } from '../state/ThemeProvider'
import { CosmicBackground } from './CosmicBackground'
import {
  InfoIcon,
  LeafIcon,
  MoonIcon,
  PauseIcon,
  PlayIcon,
  SeedIcon,
  SparkIcon,
  SunIcon,
  WaveIcon,
} from './Icons'
import { InstallPrompt } from './InstallPrompt'

const TABS = [
  { to: '/create', label: 'Create', icon: SeedIcon },
  { to: '/player', label: 'Player', icon: PlayIcon },
  { to: '/saved', label: 'Saved', icon: LeafIcon },
  { to: '/sounds', label: 'Sounds', icon: WaveIcon },
]

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { session, pause, resume } = useSession()
  const reducedMotion = useReducedMotion()
  const mainRef = useRef<HTMLElement>(null)

  const isPlaying = session.status === 'playing'
  const hasSession = session.status !== 'idle'
  const showMiniPlayer = hasSession && location.pathname !== '/player'

  // A gentle stagger as each screen arrives. Skipped when motion is reduced.
  useGSAP(
    () => {
      if (reducedMotion) return
      const targets = mainRef.current?.querySelectorAll('[data-rise]')
      // A redirect route renders nothing to animate on the very first pass.
      if (!targets || targets.length === 0) return
      gsap.from(targets, {
        opacity: 0,
        y: 16,
        duration: 0.55,
        ease: 'power2.out',
        stagger: 0.06,
        clearProps: 'opacity,transform',
      })
    },
    { scope: mainRef, dependencies: [location.pathname, reducedMotion] },
  )

  return (
    <div className="relative flex min-h-dvh flex-col">
      <CosmicBackground active={isPlaying} />

      <header className="safe-top px-4 pb-3">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
          <NavLink
            to="/create"
            className="group flex items-center gap-2.5 rounded-2xl py-1 pr-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-surface text-[1.05rem] text-[var(--rose-deep)]">
              <SparkIcon />
            </span>
            <span className="shimmer-ink font-display text-[1.45rem] tracking-tight">
              Manifester
            </span>
          </NavLink>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => navigate('/about')}
              aria-label="About and install instructions"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-surface text-[1.05rem] text-ink-muted transition-colors hover:text-ink"
            >
              <InfoIcon />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === 'day' ? 'Switch to night colours' : 'Switch to day colours'
              }
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-surface text-[1.05rem] text-ink-muted transition-colors hover:text-ink"
            >
              {theme === 'day' ? <MoonIcon /> : <SunIcon />}
            </button>
          </div>
        </div>
      </header>

      <main
        ref={mainRef}
        className="mx-auto w-full max-w-2xl grow px-4 pb-40"
        id="main"
      >
        <Outlet />
      </main>

      {showMiniPlayer && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 px-4">
          <div className="surface-sheet pointer-events-auto mx-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl px-3 py-2.5 shadow-[var(--shadow-lift)]">
            <button
              type="button"
              onClick={isPlaying ? pause : resume}
              aria-label={isPlaying ? 'Pause the loop' : 'Resume the loop'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--rose-deep)] text-[1.1rem] text-[var(--bg-0)]"
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              onClick={() => navigate('/player')}
              className="min-w-0 grow text-left"
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

      <nav
        aria-label="Main sections"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface-strong)] backdrop-blur-xl"
      >
        <ul className="safe-bottom mx-auto flex w-full max-w-2xl items-stretch px-2 pt-1.5">
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                onClick={() => cue('tap')}
                className={({ isActive }) =>
                  cx(
                    'flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5',
                    'text-[0.72rem] font-medium tracking-wide transition-colors duration-200',
                    isActive
                      ? 'text-[var(--rose-deep)]'
                      : 'text-ink-faint hover:text-ink-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cx(
                        'flex h-8 w-12 items-center justify-center rounded-pill text-[1.15rem] transition-colors duration-200',
                        isActive && 'bg-[var(--rose-soft)]',
                      )}
                    >
                      <Icon />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <InstallPrompt />
    </div>
  )
}
