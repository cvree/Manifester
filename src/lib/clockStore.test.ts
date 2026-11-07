import { describe, expect, it, vi } from 'vitest'
import { ClockStore, EMPTY_READING } from './clockStore'

describe('ClockStore', () => {
  it('starts empty', () => {
    expect(new ClockStore().get()).toEqual(EMPTY_READING)
  })

  it('rounds elapsed down and countdowns up', () => {
    const store = new ClockStore()
    store.set({ elapsedSeconds: 12.9, remainingSeconds: 0.2, delayRemaining: 2.01 })
    expect(store.get()).toEqual({
      elapsedSeconds: 12,
      remainingSeconds: 1,
      delayRemaining: 3,
    })
  })

  it('only notifies when a whole second moves', () => {
    const store = new ClockStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.set({ remainingSeconds: 59.9 })
    store.set({ remainingSeconds: 59.6 })
    store.set({ remainingSeconds: 59.1 })
    expect(listener).toHaveBeenCalledTimes(1)
    store.set({ remainingSeconds: 58.9 })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('keeps the same object between changes', () => {
    const store = new ClockStore()
    store.set({ elapsedSeconds: 3 })
    const first = store.get()
    store.set({ elapsedSeconds: 3.7 })
    expect(store.get()).toBe(first)
  })

  it('leaves fields it was not given alone, and clears to null', () => {
    const store = new ClockStore()
    store.set({ elapsedSeconds: 5, remainingSeconds: 60 })
    store.set({ delayRemaining: 4 })
    expect(store.get()).toEqual({
      elapsedSeconds: 5,
      remainingSeconds: 60,
      delayRemaining: 4,
    })
    store.set({ delayRemaining: null })
    expect(store.get().delayRemaining).toBeNull()
  })

  it('unsubscribes', () => {
    const store = new ClockStore()
    const listener = vi.fn()
    const off = store.subscribe(listener)
    off()
    store.set({ elapsedSeconds: 1 })
    expect(listener).not.toHaveBeenCalled()
  })
})
