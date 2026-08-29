import { describe, expect, it } from 'vitest'
import { everyString, PROSE_FAULTS } from './prose'

/**
 * The guards themselves, checked against the sentences that caused them.
 *
 * A test that only ever passes is not evidence of anything, and a regular
 * expression loosened enough to stop firing on good English can very easily be
 * loosened past the bug it was written for. Every line below is a real
 * sentence this feature produced at some point, or a real one it must not
 * flag.
 */

function faults(text: string): string[] {
  return PROSE_FAULTS.filter((fault) => fault.pattern.test(text)).map(
    (fault) => fault.name,
  )
}

describe('the prose guards', () => {
  it('catches the sentences that were actually broken', () => {
    expect(faults('At the centre you is felt before it is understood.')).toContain(
      'a subject that does not agree',
    )
    expect(
      faults('Your appetite for more and your what you are building are in square.'),
    ).toContain('a possessive in front of a clause')
    expect(faults('The sky is weighted towards fire. by getting it out of your head.')).toContain(
      'a sentence that starts in lower case',
    )
    expect(faults('Moon in undefined, 40% lit.')).toContain('a missing value')
    expect(faults('It is easing off.. That is the one to stop forcing.')).toContain(
      'a doubled full stop',
    )
    expect(faults('You will stay in the the same thing.')).toContain('a doubled word')
  })

  it('leaves correct English alone', () => {
    const fine = [
      'What actually settles you is beauty, company and time.',
      'Neither of you is doing anything wrong.',
      'The standing version of this for you is the stomach and the chest.',
      'That is the one to stop forcing today.',
      'Saturn is 1.6° from exact — this is the peak of it.',
      'Your Moon is in Libra, so you look for the fair version of the answer.',
    ]
    for (const text of fine) expect(faults(text), text).toEqual([])
  })

  it('finds every string in a nested reading', () => {
    const found = everyString({
      headline: 'one',
      areas: [{ text: 'two', action: 'three' }],
      at: new Date(),
      dial: 7,
      power: null,
    })
    expect(found).toEqual(['one', 'two', 'three'])
  })
})
