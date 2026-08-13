/** Active listening time: wall time advances only while playback is running. */
export class ActiveTimeClock {
  private accumulatedMs = 0
  private runningSince: number | null = null

  start(now = Date.now()): void {
    this.accumulatedMs = 0
    this.runningSince = now
  }

  pause(now = Date.now()): void {
    if (this.runningSince == null) return
    this.accumulatedMs += Math.max(0, now - this.runningSince)
    this.runningSince = null
  }

  resume(now = Date.now()): void {
    if (this.runningSince != null) return
    this.runningSince = now
  }

  reset(): void {
    this.accumulatedMs = 0
    this.runningSince = null
  }

  elapsedMs(now = Date.now()): number {
    return (
      this.accumulatedMs +
      (this.runningSince == null ? 0 : Math.max(0, now - this.runningSince))
    )
  }

  elapsedSeconds(now = Date.now()): number {
    return this.elapsedMs(now) / 1000
  }

  get isRunning(): boolean {
    return this.runningSince != null
  }
}
