import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canShare,
  canShareFiles,
  copyText,
  createLoopShareUrl,
  decodeSharedLoop,
  encodeSharedLoop,
  loopShareText,
  shareFile,
  shareText,
} from './share'
import { DEFAULT_SETTINGS, type SavedLoop } from './types'

/** A `navigator` with only the bits a given test cares about. */
function stubNavigator(parts: Record<string, unknown>) {
  vi.stubGlobal('navigator', parts)
}

function abort(): Error {
  const error = new Error('Share canceled')
  error.name = 'AbortError'
  return error
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('loopShareText', () => {
  it('puts the title above the words', () => {
    expect(loopShareText('Morning', 'I am steady.')).toBe(
      'Morning\n\nI am steady.',
    )
  })

  it('never leaves a stray blank line when one half is missing', () => {
    expect(loopShareText('  ', 'I am steady.')).toBe('I am steady.')
    expect(loopShareText('Morning', '   ')).toBe('Morning')
  })
})

describe('capability checks', () => {
  it('reports no share sheet when the browser has none', () => {
    stubNavigator({})
    expect(canShare()).toBe(false)
    expect(canShareFiles([])).toBe(false)
  })

  it('does not claim file sharing from the presence of share alone', () => {
    // Several browsers take text and refuse files; `share` on its own is not
    // the answer to "will this take an MP3?".
    stubNavigator({ share: vi.fn() })
    expect(canShare()).toBe(true)
    expect(canShareFiles([])).toBe(false)
  })

  it('asks canShare about the actual files', () => {
    const canShareSpy = vi.fn().mockReturnValue(true)
    stubNavigator({ share: vi.fn(), canShare: canShareSpy })
    const file = new File(['x'], 'loop.mp3', { type: 'audio/mpeg' })

    expect(canShareFiles([file])).toBe(true)
    expect(canShareSpy).toHaveBeenCalledWith({ files: [file] })
  })

  it('treats a throwing canShare as a no', () => {
    stubNavigator({
      share: vi.fn(),
      canShare: () => {
        throw new Error('nope')
      },
    })
    expect(canShareFiles([])).toBe(false)
  })
})

describe('shareText', () => {
  it('uses the share sheet when there is one', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ share })

    await expect(shareText({ title: 'Morning', text: 'words' })).resolves.toBe(
      'shared',
    )
    expect(share).toHaveBeenCalledWith({ title: 'Morning', text: 'words' })
  })

  it('says nothing when the user backs out of the sheet', async () => {
    const writeText = vi.fn()
    stubNavigator({
      share: vi.fn().mockRejectedValue(abort()),
      clipboard: { writeText },
    })

    await expect(shareText({ title: 'Morning', text: 'words' })).resolves.toBe(
      'dismissed',
    )
    // Dismissing is a decision, not a failure — nothing goes to the clipboard.
    expect(writeText).not.toHaveBeenCalled()
  })

  it('falls back to the clipboard when there is no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ clipboard: { writeText } })

    await expect(shareText({ title: 'Morning', text: 'words' })).resolves.toBe(
      'copied',
    )
    expect(writeText).toHaveBeenCalledWith('words')
  })

  it('falls back to the clipboard when the share sheet itself fails', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubNavigator({
      share: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
      clipboard: { writeText },
    })

    await expect(shareText({ title: 'Morning', text: 'words' })).resolves.toBe(
      'copied',
    )
  })

  it('reports failure rather than pretending, with nowhere to put the words', async () => {
    stubNavigator({})
    await expect(shareText({ title: 'Morning', text: 'words' })).resolves.toBe(
      'failed',
    )
  })
})

describe('shareFile', () => {
  const file = new File(['x'], 'loop.mp3', { type: 'audio/mpeg' })

  it('refuses rather than throwing where files cannot be shared', async () => {
    const share = vi.fn()
    stubNavigator({ share })

    await expect(shareFile(file, 'loop.mp3')).resolves.toBe('failed')
    expect(share).not.toHaveBeenCalled()
  })

  it('hands the file over when the device will take it', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ share, canShare: () => true })

    await expect(shareFile(file, 'loop.mp3')).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({ files: [file], title: 'loop.mp3' })
  })

  it('separates a dismissal from a failure', async () => {
    stubNavigator({
      share: vi.fn().mockRejectedValue(abort()),
      canShare: () => true,
    })
    await expect(shareFile(file, 'loop.mp3')).resolves.toBe('dismissed')
  })
})

describe('copyText', () => {
  it('returns false rather than throwing when there is no clipboard at all', async () => {
    stubNavigator({})
    await expect(copyText('words')).resolves.toBe(false)
  })

  it('returns false when the clipboard refuses', async () => {
    stubNavigator({
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    await expect(copyText('words')).resolves.toBe(false)
  })
})

describe('loop links', () => {
  const loop: SavedLoop = {
    ...DEFAULT_SETTINGS,
    id: 'loop-1',
    title: 'Night calm',
    text: 'I am safe.\nI can rest.',
    createdAt: 1,
    updatedAt: 2,
    lastPlayedAt: 3,
    voiceURI: 'device-only',
    voiceName: 'Only here',
    recordingId: 'recording-only-here',
  }

  it('round-trips the words and portable settings without local-only ids', () => {
    const restored = decodeSharedLoop(encodeSharedLoop(loop))
    expect(restored.title).toBe('Night calm')
    expect(restored.text).toBe(loop.text)
    expect(restored.rate).toBe(loop.rate)
    expect(restored.voiceURI).toBeNull()
    expect(restored.recordingId).toBeNull()
  })

  it('creates a HashRouter link that opens the import route', () => {
    const url = createLoopShareUrl(loop, 'https://example.com/Manifester/#/library')
    expect(url).toContain('#/share?loop=')
  })

  it('rejects malformed or outdated links without inventing a loop', () => {
    expect(() => decodeSharedLoop('not-base64')).toThrow('not valid')
  })
})
