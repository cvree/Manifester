import { describe, expect, it } from 'vitest'
import { sanitiseLines } from './enhance'
import { keyLooksWrong, PROVIDERS } from './providers'
import { maskKey } from './credentials'

/**
 * The model's reply is parsed as data, not read by a person, so everything
 * here is about surviving the ways a helpful assistant breaks a line parser.
 */
describe('reading a model reply', () => {
  it('strips numbering, bullets and quote marks', () => {
    const reply = [
      '1. I am steady before meetings.',
      '2) I trust the way I see things.',
      '- I move at my own pace.',
      '• I am allowed to rest.',
      '"I am enough."',
      '“I speak clearly.”',
    ].join('\n')

    expect(sanitiseLines(reply)).toEqual([
      'I am steady before meetings.',
      'I trust the way I see things.',
      'I move at my own pace.',
      'I am allowed to rest.',
      'I am enough.',
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

  it('refuses a line too long to say in one breath', () => {
    const rambling = `I am ${'very '.repeat(30)}calm.`
    expect(sanitiseLines(`I am calm.\n${rambling}`)).toEqual(['I am calm.'])
  })

  it('returns nothing for a reply that is entirely commentary', () => {
    expect(sanitiseLines("I'd be happy to help with that!")).toEqual([])
  })
})

describe('checking a pasted key', () => {
  it('accepts a plausible key for each provider', () => {
    for (const provider of PROVIDERS) {
      const plausible = `${provider.keyPrefix}${'x'.repeat(40)}`
      expect(keyLooksWrong(provider.id, plausible)).toBeNull()
    }
  })

  it('catches a key pasted into the wrong provider', () => {
    // An OpenAI key in the Claude box is the single most likely mistake,
    // and it must be caught before a request is spent proving it.
    const complaint = keyLooksWrong('claude', `sk-proj-${'x'.repeat(40)}`)
    expect(complaint).toContain('sk-ant-')
    expect(keyLooksWrong('gemini', `sk-ant-api03-${'x'.repeat(40)}`)).toContain('AIza')
  })

  it('offers only providers a browser can actually reach', () => {
    // ChatGPT is absent on purpose: api.openai.com sends no CORS header, so
    // the request never leaves the browser. If someone re-adds it without a
    // proxy, this fails and explains itself.
    expect(PROVIDERS.map((provider) => provider.id)).toEqual(['claude', 'gemini'])
  })

  it('catches empty and truncated pastes', () => {
    expect(keyLooksWrong('gemini', '   ')).toBe('Paste the key first.')
    expect(keyLooksWrong('gemini', 'AIzaShort')).toContain('too short')
  })
})

describe('showing a stored key back', () => {
  it('shows enough to recognise and not enough to use', () => {
    const masked = maskKey(`sk-ant-api03-${'x'.repeat(60)}abcd`)
    expect(masked.startsWith('sk-ant-a')).toBe(true)
    expect(masked.endsWith('abcd')).toBe(true)
    expect(masked).not.toContain('xxxxxxxxxx')
  })
})
