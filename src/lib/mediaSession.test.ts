import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bindMediaControls,
  clearMediaSession,
  publishNowPlaying,
  setMediaPlaybackState,
  setMediaPosition,
} from './mediaSession'

/*
 * The bug these guard is the one nobody sees from inside the app, because it
 * only exists on the outside of it: on iOS this app keeps a silent track
 * playing so the mix is not muted by the hardware silent switch, and a playing
 * media element puts a widget on the lock screen whether or not anybody asked
 * for one. Until that widget is claimed it shows no title, no artwork, and a
 * pause button the platform has wired to the silent track — so pressing pause
 * on a locked phone stops nothing and says it stopped everything.
 *
 * None of that can be caught by looking at the audio graph, and all of it is a
 * few assignments to `navigator.mediaSession`. So the assertions are about
 * what ends up on that object.
 */

interface Handlers {
  [action: string]: (() => void) | null
}

const install = (options: { positionState?: boolean } = {}) => {
  const handlers: Handlers = {}
  const setPositionState = vi.fn()
  const media = {
    metadata: null as unknown,
    playbackState: 'none',
    setActionHandler: vi.fn((action: string, handler: (() => void) | null) => {
      handlers[action] = handler
    }),
    ...(options.positionState === false ? {} : { setPositionState }),
  }
  Object.defineProperty(globalThis.navigator, 'mediaSession', {
    value: media,
    configurable: true,
    writable: true,
  })
  return { media, handlers, setPositionState }
}

/** The metadata constructor, which Node has never heard of. */
const installMetadata = () => {
  class FakeMediaMetadata {
    title: string
    artist: string
    album: string
    artwork: unknown[]
    constructor(init: {
      title?: string
      artist?: string
      album?: string
      artwork?: unknown[]
    }) {
      this.title = init.title ?? ''
      this.artist = init.artist ?? ''
      this.album = init.album ?? ''
      this.artwork = init.artwork ?? []
    }
  }
  Object.defineProperty(globalThis, 'MediaMetadata', {
    value: FakeMediaMetadata,
    configurable: true,
    writable: true,
  })
  return FakeMediaMetadata
}

const controls = () => ({
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
})

afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator as object, 'mediaSession')
  Reflect.deleteProperty(globalThis as object, 'MediaMetadata')
  vi.restoreAllMocks()
})

describe('the lock-screen transport', () => {
  it('puts the session behind play, pause and stop', () => {
    const { handlers } = install()
    const verbs = controls()
    bindMediaControls(verbs)

    handlers.play?.()
    handlers.pause?.()
    handlers.stop?.()

    expect(verbs.play).toHaveBeenCalledOnce()
    expect(verbs.pause).toHaveBeenCalledOnce()
    expect(verbs.stop).toHaveBeenCalledOnce()
  })

  /*
   * The whole point. Without a handler the platform drives the media element
   * it can see, which is the silent track — so the widget redraws as paused
   * and the voice, which never touches Web Audio, keeps speaking.
   */
  it('claims pause rather than leaving it to the silent track', () => {
    const { media } = install()
    bindMediaControls(controls())
    expect(media.setActionHandler).toHaveBeenCalledWith(
      'pause',
      expect.any(Function),
    )
  })

  /*
   * A headphone pinch and a car stereo's one button both arrive here, and on
   * some builds they arrive as `playpause` rather than as either.
   */
  it('answers a single-button remote from the state it is in', () => {
    const { media, handlers } = install()
    const verbs = controls()
    bindMediaControls(verbs)

    media.playbackState = 'playing'
    handlers.playpause?.()
    expect(verbs.pause).toHaveBeenCalledOnce()
    expect(verbs.play).not.toHaveBeenCalled()

    media.playbackState = 'paused'
    handlers.playpause?.()
    expect(verbs.play).toHaveBeenCalledOnce()
  })

  /*
   * Declining is not the same as not registering: an unclaimed slot is filled
   * by the platform's own default and pointed at the silent track, which is
   * how a widget ends up offering to scrub through forty milliseconds of
   * nothing.
   */
  it('declines the actions a loop has no answer for', () => {
    const { media } = install()
    bindMediaControls(controls())
    for (const action of [
      'seekbackward',
      'seekforward',
      'seekto',
      'previoustrack',
      'nexttrack',
    ]) {
      expect(media.setActionHandler).toHaveBeenCalledWith(action, null)
    }
  })

  it('hands the controls back when asked', () => {
    const { handlers } = install()
    bindMediaControls(controls())
    bindMediaControls(null)
    expect(handlers.play).toBeNull()
    expect(handlers.pause).toBeNull()
    expect(handlers.stop).toBeNull()
  })

  /*
   * Unsupported actions throw rather than being ignored, and which ones are
   * supported differs between every version of every browser — so one refusal
   * must not take the rest of the transport down with it.
   */
  it('survives a browser that refuses an action it has never heard of', () => {
    const { media, handlers } = install()
    media.setActionHandler.mockImplementation(
      (action: string, handler: (() => void) | null) => {
        if (action === 'stop') throw new TypeError('unsupported')
        handlers[action] = handler
      },
    )

    expect(() => bindMediaControls(controls())).not.toThrow()
    expect(handlers.pause).toBeTypeOf('function')
  })
})

describe('what the widget says', () => {
  it('names the loop, what it is, and the app', () => {
    const { media } = install()
    installMetadata()

    publishNowPlaying({ title: 'Steady hands', artist: 'Looping affirmation' })

    const metadata = media.metadata as {
      title: string
      artist: string
      album: string
    }
    expect(metadata.title).toBe('Steady hands')
    expect(metadata.artist).toBe('Looping affirmation')
    expect(metadata.album).toBe('Manifester')
  })

  /*
   * A finished session that leaves its title on the glass is a small lie told
   * to whoever unlocks the phone an hour later.
   */
  it('clears the glass when there is nothing playing', () => {
    const { media } = install()
    installMetadata()
    publishNowPlaying({ title: 'Steady hands', artist: 'Looping affirmation' })
    publishNowPlaying(null)
    expect(media.metadata).toBeNull()
  })

  it('mirrors the session rather than the silent track', () => {
    const { media } = install()
    setMediaPlaybackState('playing')
    expect(media.playbackState).toBe('playing')
    setMediaPlaybackState('paused')
    expect(media.playbackState).toBe('paused')
    setMediaPlaybackState('none')
    expect(media.playbackState).toBe('none')
  })

  it('says nothing at all where the metadata constructor is missing', () => {
    install()
    expect(() =>
      publishNowPlaying({ title: 'Steady hands', artist: 'Looping' }),
    ).not.toThrow()
  })
})

describe('the progress bar', () => {
  it('draws a timed session against the time it was given', () => {
    const { setPositionState } = install()
    setMediaPosition(90, 600)
    expect(setPositionState).toHaveBeenCalledWith({
      duration: 600,
      position: 90,
      playbackRate: 1,
    })
  })

  /*
   * `setPositionState` throws when the position is past the duration, and a
   * rounded elapsed against a rounded total can land a hair beyond it on
   * precisely the last tick — the one update that matters most.
   */
  it('never reports a position past the end', () => {
    const { setPositionState } = install()
    setMediaPosition(601, 600)
    expect(setPositionState).toHaveBeenCalledWith(
      expect.objectContaining({ position: 600 }),
    )
  })

  /* An open-ended loop has no end, so it is drawn the way live radio is. */
  it('leaves an open-ended loop without a timeline', () => {
    const { setPositionState } = install()
    setMediaPosition(90, null)
    expect(setPositionState).toHaveBeenCalledWith()
  })

  it('does nothing where the platform has no position state', () => {
    install({ positionState: false })
    expect(() => setMediaPosition(90, 600)).not.toThrow()
  })
})

describe('a browser with no Media Session API', () => {
  it('is left completely alone', () => {
    expect(() => bindMediaControls(controls())).not.toThrow()
    expect(() =>
      publishNowPlaying({ title: 'Steady hands', artist: 'Looping' }),
    ).not.toThrow()
    expect(() => setMediaPlaybackState('playing')).not.toThrow()
    expect(() => setMediaPosition(1, 2)).not.toThrow()
    expect(() => clearMediaSession()).not.toThrow()
  })
})

describe('tearing the widget down', () => {
  it('leaves nothing behind on the glass or the buttons', () => {
    const { media, handlers, setPositionState } = install()
    installMetadata()
    bindMediaControls(controls())
    publishNowPlaying({ title: 'Steady hands', artist: 'Looping' })
    setMediaPlaybackState('playing')

    clearMediaSession()

    expect(media.metadata).toBeNull()
    expect(media.playbackState).toBe('none')
    expect(handlers.play).toBeNull()
    expect(handlers.pause).toBeNull()
    expect(setPositionState).toHaveBeenLastCalledWith()
  })
})
