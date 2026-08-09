import { describe, expect, it } from 'vitest'
import {
  chunkText,
  clampVoiceVolume,
  LIVE_VOICE_VOLUME_CAP,
  MAX_VOICE_VOLUME,
} from './speech'
import { affirmationLines } from './summaries'

describe('voice volume ceilings', () => {
  it('never offers a level the live voice cannot actually reach', () => {
    // `MAX_VOICE_VOLUME` bounds the setting, and so the slider and its
    // readout. `LIVE_VOICE_VOLUME_CAP` is the browser's own hard limit on
    // `SpeechSynthesisUtterance.volume` — nothing in this app can raise it,
    // because speech synthesis never touches a Web Audio node this app owns.
    // The two agree, which is the whole point: 100% on screen is 1 in the
    // engine, and there is no way to ask for more.
    expect(LIVE_VOICE_VOLUME_CAP).toBe(1)
    expect(MAX_VOICE_VOLUME).toBe(LIVE_VOICE_VOLUME_CAP)
    expect(Math.round(MAX_VOICE_VOLUME * 100)).toBe(100)
  })

  it('brings a level saved under the old ceiling back into range', () => {
    expect(clampVoiceVolume(2)).toBe(1)
    expect(clampVoiceVolume(1.35)).toBe(1)
    expect(clampVoiceVolume(0.65)).toBeCloseTo(0.65)
    expect(clampVoiceVolume(-1)).toBe(0)
    expect(clampVoiceVolume(Number.NaN)).toBe(1)
  })
})

/*
 * The player shows one line and the voice speaks one line, and the only way
 * those two are reliably the same line is if they are the same unit. So the
 * contract this file guards is a single sentence: one written line is one
 * utterance.
 *
 * It has been wrong before. Chunks used to be packed to a character budget,
 * which merged six short affirmations into one utterance while the screen
 * showed the first of them for all six.
 */
describe('splitting words into what the voice actually says', () => {
  it('speaks one line at a time, in order', () => {
    const text = [
      'I am steady before meetings.',
      'I trust the way I see things.',
      'I move at my own pace.',
      'I am allowed to rest.',
    ].join('\n')

    expect(chunkText(text)).toEqual(affirmationLines(text))
  })

  it('never merges short lines, however many would fit', () => {
    // Six lines and about 130 characters: comfortably inside the old budget,
    // and exactly the case that used to go out as one utterance.
    const lines = ['I am here.', 'I am calm.', 'I am rested.', 'I am steady.', 'I am kind.', 'I am enough.']
    expect(chunkText(lines.join('\n'))).toEqual(lines)
  })

  it('lines up with what the player counts, so an index means something', () => {
    const text = 'I am steady.\n\nI trust myself.\n\n\nI rest without earning it.\n'
    expect(chunkText(text)).toEqual(affirmationLines(text))
    expect(chunkText(text)).toHaveLength(3)
  })

  it('keeps a line whole even when it is a whole sentence with commas', () => {
    const line = 'I am steady, I am rested, and I am ready for what today asks of me.'
    expect(chunkText(line)).toEqual([line])
  })

  it('splits only a line too long to speak in one breath', () => {
    const long = `${'I am steady and rested and calm and here. '.repeat(12).trim()}`
    const parts = chunkText(long)

    expect(parts.length).toBeGreaterThan(1)
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(180)
    // Nothing is lost and nothing is reordered.
    expect(parts.join(' ').replace(/\s+/g, ' ')).toBe(long.replace(/\s+/g, ' '))
  })

  it('splits a run-on line at its clauses before its words', () => {
    const long = `${'steadiness, '.repeat(40).trim()}`
    const parts = chunkText(long)
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(180)
    expect(parts.join(' ')).toContain('steadiness,')
  })

  it('drops blank lines rather than speaking a silence into the count', () => {
    expect(chunkText('\n\n  \nI am here.\n   \n')).toEqual(['I am here.'])
    expect(chunkText('   ')).toEqual([])
    expect(chunkText('')).toEqual([])
  })

  it('handles Windows line endings the same as any other', () => {
    expect(chunkText('I am here.\r\nI am calm.')).toEqual(['I am here.', 'I am calm.'])
  })
})
