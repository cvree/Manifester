import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type SavedLoop } from '../lib/types'
import { launchDestination } from '../lib/launch'

function loop(text = 'I am here.'): SavedLoop {
  return {
    ...DEFAULT_SETTINGS,
    id: 'loop-1',
    title: 'Calm',
    text,
    createdAt: 1,
    updatedAt: 2,
    lastPlayedAt: 3,
    origin: 'kept',
  }
}

describe('launchDestination', () => {
  it('opens Player when a saved loop can be restored', () => {
    expect(launchDestination([loop()])).toBe('/player')
  })

  it('preserves the first-run Create flow for a genuinely empty library', () => {
    expect(launchDestination([])).toBe('/create')
    expect(launchDestination([loop('   ')])).toBe('/create')
  })
})
