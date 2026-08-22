import { describe, expect, it } from 'vitest'
import { likelyNextTrack, sceneFor, trackForScene, type SoundtrackScene } from './scene'
import { SOUNDTRACK_TRACKS } from './tracks'

const idle = { status: 'idle' as const }

describe('which piece belongs to a moment', () => {
  it('gives each part of the app its own piece', () => {
    expect(sceneFor({ path: '/welcome', ...idle })).toBe('arrival')
    expect(sceneFor({ path: '/create', ...idle })).toBe('shaping')
    expect(sceneFor({ path: '/library', ...idle })).toBe('reflection')
    expect(sceneFor({ path: '/about', ...idle })).toBe('reflection')
    expect(sceneFor({ path: '/share', ...idle })).toBe('reflection')
  })

  it('treats an idle player as the threshold rather than the session', () => {
    expect(sceneFor({ path: '/player', ...idle })).toBe('arrival')
  })

  it('lets a running session outrank wherever they have wandered to', () => {
    for (const path of ['/player', '/library', '/create', '/about']) {
      expect(sceneFor({ path, status: 'playing'})).toBe('listening')
      expect(sceneFor({ path, status: 'paused'})).toBe('listening')
    }
  })

  it('marks a finished loop as completion, wherever it finished', () => {
    expect(sceneFor({ path: '/player', status: 'complete'})).toBe(
      'completion',
    )
    expect(sceneFor({ path: '/library', status: 'complete'})).toBe(
      'completion',
    )
  })

  it('has a scene that means silence, for the manager to reach for', () => {
    expect(trackForScene('silent')).toBeNull()
  })

  it('holds whatever is playing on the routes that are only a redirect', () => {
    // The launch route exists for as long as IndexedDB takes to answer, and a
    // crossfade on every cold start would be a change nobody experienced.
    expect(sceneFor({ path: '/', ...idle })).toBeNull()
    expect(sceneFor({ path: '/somewhere-new', ...idle })).toBeNull()
  })

  it('ignores trailing slashes and query strings', () => {
    expect(sceneFor({ path: '/create/', ...idle })).toBe('shaping')
    expect(sceneFor({ path: '/library?show=sounds', ...idle })).toBe('reflection')
  })
})

describe('the pieces a scene points at', () => {
  const scenes: SoundtrackScene[] = [
    'arrival',
    'shaping',
    'listening',
    'completion',
    'reflection',
    'silent',
  ]

  it('names a real piece for every scene that has one', () => {
    const ids = new Set(SOUNDTRACK_TRACKS.map((track) => track.id))
    for (const scene of scenes) {
      const id = trackForScene(scene)
      if (id) expect(ids.has(id)).toBe(true)
    }
  })

  it('uses each of the five exactly once, so none is unreachable', () => {
    const used = scenes
      .map(trackForScene)
      .filter((id): id is NonNullable<ReturnType<typeof trackForScene>> => id != null)
    expect(new Set(used).size).toBe(SOUNDTRACK_TRACKS.length)
  })

  it('never warms up the piece already playing', () => {
    for (const scene of scenes) {
      const next = likelyNextTrack(scene)
      if (next) expect(next).not.toBe(trackForScene(scene))
    }
  })
})
