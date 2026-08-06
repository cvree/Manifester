import { describe, expect, it } from 'vitest'
import { addToWords, improveWords } from './wordcraft'

describe('improving words', () => {
  it('moves a wish into the present tense', () => {
    expect(improveWords('I want to be confident').text).toBe('I am confident.')
    expect(improveWords('I will be calm one day').text).toBe('I am calm one day.')
    expect(improveWords('I hope to speak up').text).toBe('I speak up.')
    expect(improveWords('Someday I am going to feel safe').text).toBe('I feel safe.')
  })

  it('turns an avoided feeling into the thing itself', () => {
    expect(improveWords('I am not anxious about Monday').text).toBe(
      'I am calm about Monday.',
    )
    expect(improveWords("I don't want to feel so lonely").text).toBe(
      'I am connected.',
    )
    expect(improveWords('I am tired of being stuck').text).toBe(
      'I am moving forward.',
    )
  })

  it('turns a plainly stated bad feeling around too', () => {
    expect(improveWords("I'm always so nervous before meetings").text).toBe(
      'I am steady before meetings.',
    )
    expect(improveWords('I feel like a failure').text).toBe(
      'I am learning and growing.',
    )
    expect(improveWords('I get overwhelmed').text).toBe('I am steady.')
  })

  it('does not read "tired of" as the feeling tired', () => {
    // Without the guard this becomes "I am allowed to rest of my job".
    expect(improveWords('I am tired of my job').text).toBe('I am tired of my job.')
  })

  it('drops an "anymore" left dangling by the negation it belonged to', () => {
    expect(improveWords("I don't want to feel like a failure anymore").text).toBe(
      'I am learning and growing.',
    )
  })

  it('sees through an intensifier and a stacked-up hedge', () => {
    expect(improveWords('i really want to be more confident').text).toBe(
      'I am more confident.',
    )
    expect(improveWords('maybe someday I will stop being awkward').text).toBe(
      'I am at ease around people.',
    )
  })

  it('reads "not good enough" as the whole phrase, not the word inside it', () => {
    expect(improveWords('I am not good enough').text).toBe('I am enough.')
    expect(improveWords('I am not enough').text).toBe('I am enough.')
    expect(improveWords('I am not too much').text).toBe('I am exactly enough.')
    // A replacement never carries a comma, or the tail of the sentence lands
    // in the middle of one: "I am enough, exactly as I am for anyone."
    expect(improveWords('im not good enough for anyone').text).toBe(
      'I am enough for anyone.',
    )
  })

  it('leaves a negation it cannot turn around rather than beheading it', () => {
    // "defeated" is not in the table, so the sentence has to survive whole —
    // the present-tense rule must not strip the "will" and leave "I not be".
    expect(improveWords('I will not be defeated').text).toBe(
      'I will not be defeated.',
    )
    expect(improveWords('I do not settle for less').text).toBe(
      'I do not settle for less.',
    )
  })

  it('speaks in the first person', () => {
    expect(improveWords('You are stronger than you know').text).toBe(
      'I am stronger than I know.',
    )
    expect(improveWords('Be kind to yourself').text).toBe('I am kind to myself.')
    expect(improveWords('Trust your timing').text).toBe('I trust my timing.')
  })

  it('gives a jotted fragment a subject', () => {
    expect(improveWords('inner peace').text).toBe('I welcome more inner peace.')
    expect(improveWords('confidence').text).toBe('I welcome more confidence.')
  })

  it('leaves a real sentence without an "I" alone', () => {
    expect(improveWords('The morning is mine.').text).toBe('The morning is mine.')
  })

  it('expands contractions so the voice says them properly', () => {
    expect(improveWords("I'm allowed to rest").text).toBe('I am allowed to rest.')
    expect(improveWords('i am here').text).toBe('I am here.')
  })

  it('keeps the shape of a multi-line draft', () => {
    const draft = 'I want to be calm.\n\nI will be brave.'
    const result = improveWords(draft)
    expect(result.text.split('\n')).toEqual(['I am calm.', '', 'I am brave.'])
    expect(result.changed).toBe(true)
  })

  it('adds a felt sense sparingly and never twice to the same line', () => {
    const draft = ['I am steady.', 'I am brave.', 'I am here.'].join('\n')
    const once = improveWords(draft).text
    const felt = once.split('\n').filter((line) => line.includes(', and '))
    expect(felt).toHaveLength(1)
  })

  it('runs to a fixed point, so pressing it again changes nothing', () => {
    const draft = [
      "I don't want to be anxious",
      'I will be confident someday',
      'Be gentle with yourself',
      'inner calm',
      'I am doing my best.',
    ].join('\n')

    const once = improveWords(draft)
    const twice = improveWords(once.text)

    expect(twice.text).toBe(once.text)
    expect(twice.changed).toBe(false)
    expect(twice.note).toBe('These already read as present, positive and yours.')
  })

  it('says what it did', () => {
    const result = improveWords('I want to be calm\nI will be strong')
    expect(result.changed).toBe(true)
    expect(result.note).toMatch(/^Reshaped 2 lines — /)
  })

  it('leaves an empty draft alone', () => {
    const result = improveWords('')
    expect(result.changed).toBe(false)
    expect(result.text).toBe('')
  })
})

describe('adding words', () => {
  it('follows the direction the draft is already going', () => {
    const result = addToWords('My chest is tight and my thoughts are racing.')
    expect(result.changed).toBe(true)
    expect(result.note).toBe('Added 3 lines about steadiness.')
    expect(result.text.split('\n')).toHaveLength(4)
  })

  it('reads the title as part of the draft', () => {
    const result = addToWords('', 'Before the interview')
    expect(result.note).toContain('to start from')
    // "interview" is a work keyword, so the lines come from there.
    expect(result.text).toContain('I begin, and beginning is the hard part.')
  })

  it('keeps what was already written and appends below it', () => {
    const result = addToWords('I am steady.')
    expect(result.text.startsWith('I am steady.\n')).toBe(true)
  })

  it('finds different lines each time rather than repeating itself', () => {
    const first = addToWords('I am so tired of feeling lonely.')
    const second = addToWords(first.text)
    const firstAdded = first.text.split('\n').slice(1)
    const secondAdded = second.text.split('\n').slice(-3)
    expect(firstAdded).toHaveLength(3)
    expect(secondAdded.some((line) => firstAdded.includes(line))).toBe(false)
  })

  it('admits when it has nothing left to offer', () => {
    let text = 'I am lonely.'
    // Far more presses than either pool can answer.
    for (let index = 0; index < 12; index += 1) text = addToWords(text).text
    const exhausted = addToWords(text)
    expect(exhausted.changed).toBe(false)
    expect(exhausted.text).toBe(text)
    expect(exhausted.note).toContain('The next words are yours')
  })

  it('falls back to general lines when the draft points nowhere', () => {
    const result = addToWords('Zqx.')
    expect(result.changed).toBe(true)
    expect(result.note).toBe('Added 3 lines that sit alongside what you wrote.')
  })

  it('produces lines that the improver has nothing to say about', () => {
    // The two halves of the helper must agree: anything Add writes is already
    // present, first person and positive, so Improve leaves it untouched.
    const added = addToWords('', 'A calm morning').text
    expect(improveWords(added).changed).toBe(false)
  })
})
