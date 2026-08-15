import { describe, expect, it } from 'vitest'
import { PronunciationNormalizer, kokoroPhonemeMarkup } from './normalizer'
import type { PronunciationEntry } from './types'

const say = () => new PronunciationNormalizer({ supportsPhonemes: false })
const phonemes = () =>
  new PronunciationNormalizer({
    supportsPhonemes: true,
    renderPhoneme: kokoroPhonemeMarkup,
  })

describe('the pronunciation dictionary', () => {
  it('respells the terms that engines get wrong', () => {
    const normalizer = say()
    const cases: Array<[string, string]> = [
      ['photosynthesis', 'foh-toh-SIN-thuh-sis'],
      ['acetaminophen', 'uh-see-tuh-MIN-oh-fen'],
      ['gastroenterology', 'gas-troh-en-ter-OL-uh-jee'],
      ['dupilumab', 'doo-PILL-yoo-mab'],
      ['SpO2', 'ess pee oh two'],
      ['CSUCI', 'see ess you see eye'],
      ['Overwatch', 'OH-ver-watch'],
      ['Kiriko', 'kee-REE-koh'],
      ['Reinhardt', 'RINE-hart'],
    ]
    for (const [input, expected] of cases) {
      expect(normalizer.normalize(input).text).toBe(expected)
    }
  })

  it('keeps a two-word species together rather than as two terms', () => {
    // `Clostridioides` on its own is not in the dictionary, so a rule that
    // matched word by word would leave half the phrase untouched — and a
    // longest-match failure here reads as a clinician mispronouncing a
    // pathogen, which is exactly the sort of thing this file exists for.
    expect(say().normalize('Clostridioides difficile').text).toBe(
      'kloss-trid-ee-OY-deez dif-uh-SEEL',
    )
    expect(
      say().normalize('A case of Clostridioides difficile was reported.').text,
    ).toBe('A case of kloss-trid-ee-OY-deez dif-uh-SEEL was reported.')
  })

  it('sends IPA to an engine that takes it, and a respelling to one that does not', () => {
    expect(phonemes().normalize('photosynthesis').text).toBe(
      '[photosynthesis](/ˌfoʊtoʊˈsɪnθəsɪs/)',
    )
    expect(say().normalize('photosynthesis').text).toBe('foh-toh-SIN-thuh-sis')
  })

  it('matches terms that end in a symbol', () => {
    // `Na+` cannot be bounded on the right by a word boundary, because `+` is
    // not a word character. Requiring one anyway is the version of this that
    // silently never matches.
    expect(say().normalize('Na+ is 140.').text).toBe('sodium is 140.')
    expect(say().normalize('Check Na+').text).toBe('Check sodium')
  })

  it('does not match inside a longer word', () => {
    const normalizer = say()
    expect(normalizer.normalize('photosynthesises').text).toBe('photosynthesises')
    expect(normalizer.normalize('Kirikomi').text).toBe('Kirikomi')
  })

  it('honours case sensitivity where the term demands it', () => {
    // "csuci" in lower case is not the university, and "IPA" spelled out is
    // only right when it was written as an initialism.
    expect(say().normalize('csuci').text).toBe('csuci')
    expect(say().normalize('CSUCI').text).toBe('see ess you see eye')
  })

  it('reads symbols the way a person would', () => {
    const normalizer = say()
    expect(normalizer.normalize('Rest & repair').text).toBe('Rest and repair')
    expect(normalizer.normalize('SpO2 is 98%').text).toBe('ess pee oh two is 98 percent')
    expect(normalizer.normalize('I am here — and steady').text).toBe(
      'I am here, and steady',
    )
    expect(normalizer.normalize('One day…').text).toBe('One day,')
  })

  it('leaves everything it does not recognise exactly as written', () => {
    const untouched = 'I am becoming someone I would be glad to know.'
    expect(say().normalize(untouched).text).toBe(untouched)
    expect(say().normalize(untouched).applied).toEqual([])
  })

  it('never rewrites its own output', () => {
    // A respelling containing the word "and" is not an ampersand somebody
    // typed, and a claim-based pass is what guarantees that.
    const normalizer = new PronunciationNormalizer({
      entries: [
        { term: 'alpha', say: 'beta' },
        { term: 'beta', say: 'gamma' },
      ],
      scopes: [],
    })
    expect(normalizer.normalize('alpha').text).toBe('beta')
  })

  it('can be told about a term at runtime', () => {
    const normalizer = say()
    expect(normalizer.normalize('Aiyana').text).toBe('Aiyana')
    normalizer.add([{ term: 'Aiyana', say: 'eye-AH-nuh', scope: 'app' }])
    expect(normalizer.normalize('Aiyana').text).toBe('eye-AH-nuh')
  })

  it('keeps subject dictionaries out of rooms they do not belong in', () => {
    const clinical = new PronunciationNormalizer({ scopes: ['medical'] })
    const game = new PronunciationNormalizer({ scopes: ['gaming'] })
    expect(clinical.normalize('SpO2').text).toBe('ess pee oh two')
    expect(game.normalize('SpO2').text).toBe('SpO2')
    expect(game.normalize('Kiriko').text).toBe('kee-REE-koh')
  })

  it('hands back a recording when one phrase has earned its own', () => {
    const entries: PronunciationEntry[] = [
      {
        term: 'Manifester',
        audio: 'overrides/manifester.opus',
        scope: 'app',
      },
    ]
    const normalizer = new PronunciationNormalizer({ entries })
    expect(normalizer.normalize('Manifester').audio).toBe(
      'overrides/manifester.opus',
    )
    expect(normalizer.normalize('Manifester.').audio).toBe(
      'overrides/manifester.opus',
    )
    // Only for the whole phrase: splicing a recording into the middle of a
    // synthesised sentence sounds exactly as bad as it sounds like it would.
    expect(normalizer.normalize('I use Manifester daily.').audio).toBeUndefined()
  })

  it('straightens quotes, which are a tokenisation problem rather than a taste one', () => {
    expect(say().normalize('I’m steady').text).toBe("I'm steady")
  })

  it('survives a malformed rule rather than taking the voice down with it', () => {
    const normalizer = new PronunciationNormalizer({
      entries: [
        { term: 'broken', match: 'pattern', pattern: '([', say: 'x' },
        { term: 'fine', say: 'grand' },
      ],
      scopes: [],
    })
    expect(normalizer.normalize('fine').text).toBe('grand')
  })
})
