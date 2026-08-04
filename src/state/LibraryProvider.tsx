/**
 * The user's local library: saved loops and imported sounds.
 *
 * Everything lives in IndexedDB on this device. There is no sync, no server,
 * and no export path other than the one the user drives themselves.
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
import { createId } from '../lib/format'
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
  findTrack: (id: string) => TrackMeta | undefined
  importTracks: (files: FileList | File[]) => Promise<{ added: number; skipped: string[] }>
  renameTrack: (id: string, name: string) => Promise<void>
  removeTrack: (id: string) => Promise<void>
  saveLoop: (loop: SavedLoop) => Promise<void>
  removeLoop: (id: string) => Promise<void>
  duplicateLoop: (id: string) => Promise<SavedLoop | null>
  touchLoop: (id: string) => Promise<void>
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [customTracks, setCustomTracks] = useState<TrackMeta[]>([])
  const [loops, setLoops] = useState<SavedLoop[]>([])
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)

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
      const copy: SavedLoop = {
        ...source,
        id: createId('loop'),
        title: `${source.title} (copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
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

  const value = useMemo<LibraryContextValue>(
    () => ({
      builtinTracks: BUILTIN_TRACKS,
      customTracks,
      allTracks,
      loops,
      ready,
      storageError,
      findTrack,
      importTracks,
      renameTrack,
      removeTrack,
      saveLoop,
      removeLoop,
      duplicateLoop,
      touchLoop,
    }),
    [
      customTracks,
      allTracks,
      loops,
      ready,
      storageError,
      findTrack,
      importTracks,
      renameTrack,
      removeTrack,
      saveLoop,
      removeLoop,
      duplicateLoop,
      touchLoop,
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
