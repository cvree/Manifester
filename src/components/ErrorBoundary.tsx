import { Component, type ErrorInfo, type ReactNode } from 'react'
import {
  isChunkLoadError,
  recordDiagnostic,
  reloadForFreshChunks,
} from '../lib/diagnostics'
import { Button } from './Button'

/**
 * Somewhere for a mistake to land that is not a blank white screen.
 *
 * React unmounts the whole tree when something throws while rendering and
 * nothing catches it. For an app people use with their eyes half closed in a
 * dark room, that is the worst possible failure: the screen goes white, the
 * words stop, and there is no way back but to know to close and reopen it.
 *
 * There are two of these. The route boundary sits inside the shell, *below*
 * the session, the library and the preferences — so when one screen breaks,
 * the breath, the voice and the ambience carry on underneath, the navigation
 * stays, and moving to another screen clears the error. The app boundary sits
 * around everything as the last resort, and can only offer to start again.
 */

interface BoundaryProps {
  children: ReactNode
  /** Changing this clears the error — the route boundary passes the path. */
  resetKey?: string
  /** `route` keeps the app around it; `app` is the last line. */
  scope: 'route' | 'app'
}

interface BoundaryState {
  error: unknown
  resetKey?: string
}

export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { error }
  }

  static getDerivedStateFromProps(
    props: BoundaryProps,
    state: BoundaryState,
  ): Partial<BoundaryState> | null {
    // A new screen is a fresh start.
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey }
    }
    return null
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    recordDiagnostic(
      isChunkLoadError(error) ? 'chunk' : 'render',
      error instanceof Error
        ? Object.assign(new Error(error.message), {
            name: error.name,
            stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}`,
          })
        : error,
    )
  }

  private retry = () => {
    this.setState({ error: null })
  }

  private reload = () => {
    if (!reloadForFreshChunks()) window.location.reload()
  }

  render(): ReactNode {
    const { error } = this.state
    if (error === null) return this.props.children

    const stale = isChunkLoadError(error)

    if (this.props.scope === 'app') {
      return (
        <div
          role="alert"
          className="flex min-h-[100svh] flex-col items-center justify-center gap-5 px-6 text-center"
          style={{ background: 'var(--bg-0, #171423)', color: 'var(--ink, #f3ece4)' }}
        >
          <p className="font-display text-[1.6rem] leading-tight">Something slipped.</p>
          <p className="max-w-sm text-[1rem] leading-relaxed opacity-80">
            Manifester ran into a problem and needs to start again. Your saved
            loops and settings are safe on this device.
          </p>
          <button
            type="button"
            onClick={this.reload}
            className="min-h-11 rounded-full border border-current px-6 py-2.5 text-[1rem]"
          >
            Start again
          </button>
        </div>
      )
    }

    return (
      <section
        role="alert"
        className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center"
      >
        <p className="font-display text-[1.5rem] leading-tight text-ink">
          {stale ? 'A newer version is ready.' : 'This screen slipped.'}
        </p>
        <p className="text-[1rem] leading-relaxed text-ink-muted">
          {stale
            ? 'Part of this screen has been updated since the app was opened. Reloading picks up the new version — anything playing will stop.'
            : 'Something went wrong drawing this screen. Anything that was playing is still playing, and your loops are safe.'}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {stale ? (
            <Button variant="primary" onClick={this.reload}>
              Reload now
            </Button>
          ) : (
            <Button variant="primary" onClick={this.retry}>
              Try again
            </Button>
          )}
        </div>
      </section>
    )
  }
}
