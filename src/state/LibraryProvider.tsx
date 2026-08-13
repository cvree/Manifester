/**
 * The user's local library: saved loops, imported sounds, recordings and the
 * quiet total that reflects time spent listening. Everything stays local.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AMBIENT_PRESETS } from '../lib/ambient'
import { readAudioDuration } from '../lib/audio'
import {
  createLibraryBackupJson,
  parseLibraryBackup,
  prepareRestore,
} from '../lib/backup'
import { createId } from '../lib/format'
import {
  addListening,
  mergeListeningStats,
  readListeningStats,
  writeListeningStats,
  type ListeningStats,
} from '../lib/listening'
import * as storage from '../lib/storage'
import { MAX_TRACK_BYTES, type SavedLoop, type TrackMeta } from '../lib/types'

const BUILTIN_TRACKS: TrackMeta[] = AMBIENT_PRESETS.map((preset) => ({
  id: preset.id,
  name: preset.name,
  kind: 'builtin',
  description: preset.description,
  createdAt: 0,
}))

interface LibraryContextValue {
  builtinTracks: TrackMeta[]
  customTracks: TrackMeta[]
  allTracks: TrackMeta[]
  loops: SavedLoop[]
  ready: boolean
  storageError: string | null
  listeningStats: ListeningStats
  findTrack: (id: string) => TrackMeta | undefined
  importTracks: (files: FileList | File[]) => Promise<{ added: number; skipped: string[] }>
  renameTrack: (id: string, name: string) => Promise<void>
  removeTrack: (id: string) => Promise<void>
  saveLoop: (loop: SavedLoop) => Promise<void>
  removeLoop: (id: string) => Promise<void>
  duplicateLoop: (id: string) => Promise<SavedLoop | null>
  touchLoop: (id: string) => Promise<void>
  recordListening: (seconds: number, countSession: boolean, startedAt: number) => void
  createBackup: () => Promise<string>
  restoreBackup: (text: string) => Promise<{ added: number; skipped: number }>
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [customTracks, setCustomTracks] = useState<TrackMeta[]>([])
  const [loops, setLoops] = useState<SavedLoop[]>([])
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [listeningStats, setListeningStats] = useState(readListeningStats)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [tracks, savedLoops] = await Promise.all([
          storage.listCustomTracks(),
          storage.listLoops(),
        ])
        if (cancelled) return
        setCustomTracks(tracks.map(stripBlob))
        setLoops(savedLoops)
      } catch {
        if (cancelled) return
        setStorageError(
          'This browser is blocking local storage, so saving is turned off. Private browsing windows often do this.',
        )
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const allTracks = useMemo(
    () => [...BUILTIN_TRACKS, ...customTracks],
    [customTracks],
  )

  const findTrack = useCallback(
    (id: string) => allTracks.find((track) => track.id === id),
    [allTracks],
  )

  const importTracks = useCallback<LibraryContextValue['importTracks']>(
    async (files) => {
      const list = Array.from(files)
      const skipped: string[] = []
      const added: TrackMeta[] = []
      for (const file of list) {
        if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|ogg|oga|flac|webm)$/i.test(file.name)) {
          skipped.push(`${file.name} — not an audio file`)
          continue
        }
        if (file.size > MAX_TRACK_BYTES) {
          skipped.push(`${file.name} — larger than 40 MB`)
          continue
        }
        const durationSeconds = await readAudioDuration(file)
        const track: storage.StoredTrack = {
          id: createId('track'),
          name: file.name.replace(/\.[^.]+$/, ''),
          kind: 'custom',
          mimeType: file.type || 'audio/mpeg',
          sizeBytes: file.size,
          durationSeconds,
          createdAt: Date.now(),
          blob: file,
        }
        try {
          await storage.putCustomTrack(track)
          added.push(stripBlob(track))
        } catch {
          skipped.push(`${file.name} — this device ran out of storage room`)
        }
      }
      if (added.length > 0) setCustomTracks((current) => [...current, ...added])
      return { added: added.length, skipped }
    },
    [],
  )

  const renameTrack = useCallback(async (id: string, name: string) => {
    const stored = await storage.getCustomTrack(id)
    if (!stored) return
    const next = { ...stored, name: name.trim() || stored.name }
    await storage.putCustomTrack(next)
    setCustomTracks((current) =>
      current.map((track) => (track.id === id ? stripBlob(next) : track)),
    )
  }, [])

  const removeTrack = useCallback(async (id: string) => {
    await storage.deleteCustomTrack(id)
    setCustomTracks((current) => current.filter((track) => track.id !== id))
  }, [])

  const saveLoop = useCallback(async (loop: SavedLoop) => {
    await storage.putLoop(loop)
    setLoops((current) => {
      const without = current.filter((item) => item.id !== loop.id)
      return [loop, ...without].sort((a, b) => b.updatedAt - a.updatedAt)
    })
  }, [])

  const removeLoop = useCallback(async (id: string) => {
    await storage.deleteLoop(id)
    setLoops((current) => current.filter((loop) => loop.id !== id))
  }, [])

  const duplicateLoop = useCallback<LibraryContextValue['duplicateLoop']>(
    async (id) => {
      const source = loops.find((loop) => loop.id === id)
      if (!source) return null
      const now = Date.now()
      const copy: SavedLoop = {
        ...source,
        id: createId('loop'),
        title: `${source.title} (copy)`,
        createdAt: now,
        updatedAt: now,
        lastPlayedAt: null,
      }
      await storage.putLoop(copy)
      setLoops((current) => [copy, ...current])
      return copy
    },
    [loops],
  )

  const touchLoop = useCallback(
    async (id: string) => {
      const source = loops.find((loop) => loop.id === id)
      if (!source) return
      const next = { ...source, lastPlayedAt: Date.now() }
      await storage.putLoop(next)
      setLoops((current) => current.map((loop) => (loop.id === id ? next : loop)))
    },
    [loops],
  )

  const recordListening = useCallback<LibraryContextValue['recordListening']>(
    (seconds, countSession, startedAt) => {
      setListeningStats((current) => {
        const next = addListening(current, seconds, countSession, startedAt)
        writeListeningStats(next)
        return next
      })
    },
    [],
  )

  const createBackup = useCallback(async () => {
    const [storedTracks, recordings] = await Promise.all([
      storage.listCustomTracks(),
      storage.listRecordings(),
    ])
    return createLibraryBackupJson({
      loops,
      customTracks: storedTracks,
      recordings,
      listening: listeningStats,
    })
  }, [listeningStats, loops])

  const restoreBackup = useCallback<LibraryContextValue['restoreBackup']>(
    async (text) => {
      const incoming = parseLibraryBackup(text)
      const [storedTracks, recordings] = await Promise.all([
        storage.listCustomTracks(),
        storage.listRecordings(),
      ])
      const bundle = prepareRestore(incoming, {
        loops,
        customTracks: storedTracks,
        recordings,
      })
      await storage.importLibrarySnapshot(bundle)
      const nextListening = mergeListeningStats(listeningStats, bundle.listening)
      writeListeningStats(nextListening)
      setListeningStats(nextListening)
      if (bundle.customTracks.length > 0) {
        setCustomTracks((current) => [
          ...current,
          ...bundle.customTracks.map(stripBlob),
        ])
      }
      if (bundle.loops.length > 0) {
        setLoops((current) =>
          [...bundle.loops, ...current].sort((a, b) => b.updatedAt - a.updatedAt),
        )
      }
      return {
        added:
          bundle.loops.length + bundle.customTracks.length + bundle.recordings.length,
        skipped: bundle.skipped,
      }
    },
    [listeningStats, loops],
  )

  const value = useMemo<LibraryContextValue>(
    () => ({
      builtinTracks: BUILTIN_TRACKS,
      customTracks,
      allTracks,
      loops,
      ready,
      storageError,
      listeningStats,
      findTrack,
      importTracks,
      renameTrack,
      removeTrack,
      saveLoop,
      removeLoop,
      duplicateLoop,
      touchLoop,
      recordListening,
      createBackup,
      restoreBackup,
    }),
    [
      customTracks,
      allTracks,
      loops,
      ready,
      storageError,
      listeningStats,
      findTrack,
      importTracks,
      renameTrack,
      removeTrack,
      saveLoop,
      removeLoop,
      duplicateLoop,
      touchLoop,
      recordListening,
      createBackup,
      restoreBackup,
    ],
  )

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext)
  if (!context) throw new Error('useLibrary must be used inside <LibraryProvider>')
  return context
}

function stripBlob(track: storage.StoredTrack): TrackMeta {
  const { blob: _blob, ...meta } = track
  return meta
}
