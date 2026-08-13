import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionTimer } from './timer'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  vi.stubGlobal('window', {
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  vi.stubGlobal('document', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('SessionTimer pause and resume', () => {
  it('does not advance while paused and completes once', () => {
    const complete = vi.fn()
    const timer = new SessionTimer()
    timer.start(10_000, { onComplete: complete })

    vi.advanceTimersByTime(3_000)
    timer.pause()
    const held = timer.remainingSeconds

    vi.advanceTimersByTime(30_000)
    expect(timer.remainingSeconds).toBe(held)
    expect(complete).not.toHaveBeenCalled()

    timer.resume()
    vi.advanceTimersByTime(held * 1000 + 300)
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it('makes repeated pause and resume calls harmless', () => {
    const timer = new SessionTimer()
    timer.start(5_000, {})
    timer.pause()
    const remaining = timer.remainingSeconds
    timer.pause()
    timer.resume()
    timer.resume()
    expect(timer.remainingSeconds).toBe(remaining)
  })
})
