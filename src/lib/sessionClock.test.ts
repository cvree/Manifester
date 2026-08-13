import { describe, expect, it } from 'vitest'
import { ActiveTimeClock } from './sessionClock'

describe('ActiveTimeClock', () => {
  it('does not count time spent paused', () => {
    const clock = new ActiveTimeClock()
    clock.start(1_000)
    clock.pause(4_000)
    expect(clock.elapsedSeconds(20_000)).toBe(3)
    clock.resume(30_000)
    expect(clock.elapsedSeconds(32_000)).toBe(5)
  })

  it('makes repeated pause and resume calls idempotent', () => {
    const clock = new ActiveTimeClock()
    clock.start(0)
    clock.pause(1_000)
    clock.pause(5_000)
    clock.resume(10_000)
    clock.resume(20_000)
    expect(clock.elapsedSeconds(11_000)).toBe(2)
  })

  it('starts a new session from zero', () => {
    const clock = new ActiveTimeClock()
    clock.start(0)
    clock.pause(4_000)
    clock.start(10_000)
    expect(clock.elapsedSeconds(11_000)).toBe(1)
  })
})
