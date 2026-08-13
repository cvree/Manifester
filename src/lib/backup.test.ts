import { describe, expect, it } from 'vitest'
import {
  BACKUP_KIND,
  BACKUP_VERSION,
  createLibraryBackupJson,
  parseLibraryBackup,
  prepareRestore,
} from './backup'
import { DEFAULT_SETTINGS, type SavedLoop } from './types'

const loop: SavedLoop = {
  ...DEFAULT_SETTINGS,
  id: 'loop-1',
  title: 'Evening',
  text: 'I rest easily.',
  createdAt: 1,
  updatedAt: 2,
  lastPlayedAt: 3,
}

describe('library backup', () => {
  it('round-trips loops, listening totals and binary files', async () => {
    const json = await createLibraryBackupJson({
      loops: [loop],
      customTracks: [
        {
          id: 'track-1',
          name: 'Rain',
          kind: 'custom',
          mimeType: 'audio/wav',
          sizeBytes: 3,
          durationSeconds: 1,
          createdAt: 4,
          blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' }),
        },
      ],
      recordings: [],
      listening: { totalSeconds: 90, sessionCount: 2, firstListenedAt: 5 },
    })
    const parsed = parseLibraryBackup(json)
    expect(parsed.loops[0].title).toBe('Evening')
    expect(parsed.customTracks[0].blob.size).toBe(3)
    expect(parsed.listening.totalSeconds).toBe(90)
  })

  it('rejects malformed data before returning anything to storage', () => {
    expect(() => parseLibraryBackup('{nope')).toThrow('not a Manifester backup')
    expect(() =>
      parseLibraryBackup(
        JSON.stringify({ kind: BACKUP_KIND, version: BACKUP_VERSION, loops: [{}], customTracks: [], recordings: [] }),
      ),
    ).toThrow('missing its words')
  })

  it('merges safely without overwriting a conflicting loop', () => {
    const incoming = parseLibraryBackup(
      JSON.stringify({
        kind: BACKUP_KIND,
        version: BACKUP_VERSION,
        exportedAt: 4,
        loops: [loop],
        customTracks: [],
        recordings: [],
        listening: { totalSeconds: 0, sessionCount: 0, firstListenedAt: null },
      }),
    )
    const restored = prepareRestore(incoming, {
      loops: [{ ...loop, text: 'Newer words already here.' }],
      customTracks: [],
      recordings: [],
    })
    expect(restored.loops).toHaveLength(1)
    expect(restored.loops[0].id).not.toBe('loop-1')
  })

  it('skips an identical backup restored twice', () => {
    const incoming = { loops: [loop], customTracks: [], recordings: [], listening: { totalSeconds: 0, sessionCount: 0, firstListenedAt: null } }
    const restored = prepareRestore(incoming, {
      loops: [loop],
      customTracks: [],
      recordings: [],
    })
    expect(restored.loops).toEqual([])
    expect(restored.skipped).toBe(1)
  })
})
