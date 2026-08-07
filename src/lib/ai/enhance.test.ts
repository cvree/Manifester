import { describe, expect, it } from 'vitest'
import { isUnsafeLine, sanitiseLines } from './enhance'

/**
 * The model's reply is parsed as data, not read by a person, so everything
 * here is about surviving the ways a helpful assistant breaks a line parser —
 * and about the handful of lines that must never reach somebody's ritual
 * however confidently they were written.
 */
describe('reading a model reply', () => {
  it('strips numbering, bullets and quote marks', () => {
    const reply = [
      '1. I am steady before meetings.',
      '2) I trust the way I see things.',
      '- I move at my own pace.',
      '• I am allowed to rest.',
      '"I am enough today."',
      '“I speak clearly.”',
    ].join('\n')

    expect(sanitiseLines(reply)).toEqual([
      'I am steady before meetings.',
      'I trust the way I see things.',
      'I move at my own pace.',
      'I am allowed to rest.',
      'I am enough today.',
      'I speak clearly.',
    ])
  })

  it('drops the preamble models add no matter how firmly you ask', () => {
    const reply = [
      'Here are three new lines for your loop:',
      '',
      'I am steady.',
      'I am rested.',
      '',
      'These affirmations follow your existing themes.',
    ].join('\n')

    expect(sanitiseLines(reply)).toEqual(['I am steady.', 'I am rested.'])
  })

  it('strips markdown emphasis and fences rather than speaking them aloud', () => {
    const reply = ['```', '**I am calm.**', '---', '__I am here.__', '```'].join('\n')
    expect(sanitiseLines(reply)).toEqual(['I am calm.', 'I am here.'])
  })

  it('strips invisible characters that break the checks below', () => {
    // Zero-width spaces and control characters read as nothing on screen and
    // speak as nothing, but they defeat every length and word count here.
    expect(sanitiseLines('I am​ calm.\nI am here.')).toEqual([
      'I am calm.',
      'I am here.',
    ])
  })

  it('refuses a line too long to say in one breath', () => {
    const rambling = `I am ${'very '.repeat(30)}calm.`
    expect(sanitiseLines(`I am calm.\n${rambling}`)).toEqual(['I am calm.'])
  })

  it('refuses a single word, which is not something you can say to yourself', () => {
    expect(sanitiseLines('Calm.\nI am calm.')).toEqual(['I am calm.'])
  })

  it('returns nothing for a reply that is entirely commentary', () => {
    expect(sanitiseLines("I'd be happy to help with that!")).toEqual([])
  })
})

/*
 * An affirmation is not read once, it is repeated aloud dozens of times in a
 * deliberately suggestible state. A line that promises a cure or guarantees an
 * outcome is therefore not a harmless flourish, and the system prompt
 * forbidding it is not enough on its own — this is the check that assumes the
 * prompt was ignored.
 */
describe('refusing a line that promises something it cannot', () => {
  const promises = [
    'My cancer is gone and my body is whole.',
    'My illness is disappearing a little more each day.',
    'I no longer need my medication.',
    'This heals my body from the inside.',
    'My success is guaranteed.',
    'The universe will bring me everything I asked for.',
    'Money is coming to me from every direction.',
    'I will be rich within the year.',
    'I earn $50,000 a month with ease.',
    'Everyone will love the person I am becoming.',
  ]

  it.each(promises)('drops: %s', (line) => {
    expect(isUnsafeLine(line)).toBe(true)
    expect(sanitiseLines(line)).toEqual([])
  })

  const keepers = [
    'I am healing at my own pace.',
    'I am well enough for today.',
    'I meet my body with kindness.',
    'I am steady about money.',
    'I am becoming someone I am proud of.',
    'I am secure in what I know.',
    'I rest without needing to earn it.',
  ]

  it.each(keepers)('keeps the hope rather than the promise: %s', (line) => {
    expect(isUnsafeLine(line)).toBe(false)
    expect(sanitiseLines(line)).toEqual([line])
  })

  it('keeps the good lines out of a batch that also contains a bad one', () => {
    const reply = [
      'I am steady before meetings.',
      'My diagnosis will disappear completely.',
      'I speak at my own pace.',
    ].join('\n')

    expect(sanitiseLines(reply)).toEqual([
      'I am steady before meetings.',
      'I speak at my own pace.',
    ])
  })
})
