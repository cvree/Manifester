import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * The module keeps its state at module scope, so each test gets a fresh copy.
 */
async function load() {
  vi.resetModules()
  return import('./appUpdate')
}

let visibility: DocumentVisibilityState = 'visible'
const listeners = new Map<string, () => void>()
const reload = vi.fn()

beforeEach(() => {
  visibility = 'visible'
  listeners.clear()
  reload.mockClear()
  vi.stubGlobal('document', {
    get visibilityState() {
      return visibility
    },
    addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
  })
  vi.stubGlobal('window', {
    addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
    location: { reload },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function returnToApp() {
  visibility = 'hidden'
  listeners.get('visibilitychange')?.()
  visibility = 'visible'
  listeners.get('visibilitychange')?.()
}

describe('a new version arriving', () => {
  it('does not reload the page the moment it lands', async () => {
    const { deferReload } = await load()
    deferReload()
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads when the person comes back to an idle app', async () => {
    const { deferReload } = await load()
    deferReload()
    returnToApp()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('never reloads over a session that is playing or paused', async () => {
    const { deferReload, setSessionBusy } = await load()
    setSessionBusy(true)
    deferReload()
    returnToApp()
    expect(reload).not.toHaveBeenCalled()

    // Once the session is over, the next return is the moment.
    setSessionBusy(false)
    returnToApp()
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
