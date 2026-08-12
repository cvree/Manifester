/**
 * Session countdown.
 *
 * Wall-clock based rather than tick-counting, so a backgrounded tab (where
 * timers are throttled hard) still finishes at the right moment — and driven by
 * the heartbeat as well as by its own interval, so "the right moment" is not
 * left to a timer a hidden tab is entitled to ignore. A thirty-minute session
 * should end after thirty minutes whether or not anyone was watching it.
 */

import { onHeartbeat } from './heartbeat'

export interface SessionTimerHandlers {
  onTick?: (remainingSeconds: number) => void
  onComplete?: () => void
}

const TICK_MS = 250

export class SessionTimer {
  private endsAt = 0
  private pausedRemaining: number | null = null
  private interval: number | null = null
  private release: (() => void) | null = null
  private handlers: SessionTimerHandlers = {}

  get isRunning(): boolean {
    return this.interval !== null
  }

  get remainingSeconds(): number {
    if (this.pausedRemaining != null) return this.pausedRemaining / 1000
    if (!this.endsAt) return 0
    return Math.max(0, (this.endsAt - Date.now()) / 1000)
  }

  start(durationMs: number, handlers: SessionTimerHandlers = {}): void {
    this.stop()
    this.handlers = handlers
    this.endsAt = Date.now() + durationMs
    this.pausedRemaining = null
    this.handlers.onTick?.(durationMs / 1000)
    this.run()
  }

  pause(): void {
    if (!this.isRunning) return
    this.pausedRemaining = Math.max(0, this.endsAt - Date.now())
    this.clearInterval()
  }

  resume(): void {
    if (this.pausedRemaining == null) return
    this.endsAt = Date.now() + this.pausedRemaining
    this.pausedRemaining = null
    this.run()
  }

  stop(): void {
    this.clearInterval()
    this.endsAt = 0
    this.pausedRemaining = null
  }

  private tick(): void {
    const remaining = Math.max(0, this.endsAt - Date.now())
    this.handlers.onTick?.(remaining / 1000)
    if (remaining <= 0) {
      const onComplete = this.handlers.onComplete
      this.stop()
      onComplete?.()
    }
  }

  private run(): void {
    this.clearInterval()
    // Four times a second for a countdown that reads smoothly, and the
    // heartbeat underneath it for the one tick that has to land: the last one.
    this.interval = window.setInterval(() => this.tick(), TICK_MS)
    this.release = onHeartbeat(() => this.tick())
  }

  private clearInterval(): void {
    if (this.interval != null) {
      window.clearInterval(this.interval)
      this.interval = null
    }
    this.release?.()
    this.release = null
  }
}
