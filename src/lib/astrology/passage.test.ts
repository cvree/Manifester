import { describe, expect, it } from 'vitest'
import { buildChart } from './chart'
import { horoscopeOf } from './horoscope'
import { PROSE_FAULTS } from './prose'
import { sayingSeconds } from './passage'

/**
 * The passage, held to the rules a loop is actually held to.
 *
 * It is spoken aloud, forty times, by somebody who did not write it. That
 * makes three things non-negotiable and each of them is a test below: it is in
 * the first person throughout, because a loop that says "you" is a lecture; it
 * is a genuine paragraph rather than a line with padding; and it is different
 * tomorrow, or there was no reason to build it from the sky in the first
 * place.
 */

const LISBON = { latitude: 38.7223, longitude: -9.1393 }

const CHARTS = [
  buildChart(new Date('1994-07-14T13:30:00Z'), LISBON, true),
  buildChart(new Date('1966-02-11T04:00:00Z'), LISBON, true),
  buildChart(new Date('2001-09-20T18:00:00Z'), null, false),
]

function passages(days: number, from = new Date(Date.UTC(2026, 2, 1, 9, 0))) {
  const found = []
  for (const chart of CHARTS) {
    for (let day = 0; day < days; day += 1) {
      const at = new Date(from)
      at.setUTCDate(at.getUTCDate() + day)
      found.push(horoscopeOf(chart, LISBON, at).passage)
    }
  }
  return found
}

describe('the daily passage', () => {
  it('is a paragraph rather than a line', () => {
    for (const passage of passages(20)) {
      expect(passage.sentences.length).toBeGreaterThanOrEqual(6)
      const words = passage.text.split(/\s+/).length
      expect(words, passage.text).toBeGreaterThan(60)
      // Past about a hundred and forty words it stops being a loop and starts
      // being a track, and the pause between passes lands in the wrong place.
      expect(words, passage.text).toBeLessThan(140)
      expect(passage.seconds).toBeGreaterThan(24)
      expect(passage.seconds).toBeLessThan(75)
    }
  })

  it('never speaks to the listener in the second person', () => {
    for (const passage of passages(20)) {
      expect(/\byou(r|rs|rself)?\b/i.test(passage.text), passage.text).toBe(false)
    }
  })

  it('joins cleanly — every sentence is a whole one', () => {
    for (const passage of passages(20)) {
      for (const sentence of passage.sentences) {
        expect(sentence[0], sentence).toBe(sentence[0].toUpperCase())
        expect(sentence.endsWith('.'), sentence).toBe(true)
      }
      expect(passage.text).toBe(passage.sentences.join(' '))
      for (const fault of PROSE_FAULTS) {
        expect(fault.pattern.test(passage.text), `${fault.name}: ${passage.text}`).toBe(
          false,
        )
      }
    }
  })

  it('never says the same sentence twice inside one pass', () => {
    for (const passage of passages(30)) {
      expect(new Set(passage.sentences).size).toBe(passage.sentences.length)
    }
  })

  it('says the same thing all day and something else tomorrow', () => {
    const chart = CHARTS[0]
    const morning = horoscopeOf(chart, LISBON, new Date('2026-04-02T07:15:00Z'))
    const evening = horoscopeOf(chart, LISBON, new Date('2026-04-02T21:40:00Z'))
    expect(evening.passage.text).toBe(morning.passage.text)

    const fortnight = new Set<string>()
    for (let day = 0; day < 14; day += 1) {
      fortnight.add(
        horoscopeOf(chart, LISBON, new Date(Date.UTC(2026, 3, 2 + day, 9, 0))).passage
          .text,
      )
    }
    // Fourteen days, fourteen passages: the affirmation, the Moon's sign, the
    // leading contact and the phase all move, and any one of them is enough.
    expect(fortnight.size).toBe(14)
  })

  it('has a sentence for every sign the Moon can be in, natally or today', () => {
    /*
     * The sign tables are keyed by name rather than by a union, so a missing
     * entry is a runtime `undefined` rather than a compile error. Fourteen
     * births two and a half days apart walk the natal Moon through all twelve
     * signs, and a fortnight of readings walks the transiting one through the
     * same twelve.
     */
    for (let birth = 0; birth < 14; birth += 1) {
      const chart = buildChart(
        new Date(Date.UTC(1990, 0, 1 + Math.round(birth * 2.6), 9, 0)),
        LISBON,
        true,
      )
      for (let day = 0; day < 14; day += 1) {
        const passage = horoscopeOf(
          chart,
          LISBON,
          new Date(Date.UTC(2026, 9, 1 + day, 9, 0)),
        ).passage
        expect(passage.text, passage.text).not.toContain('undefined')
        expect(passage.sentences.length).toBeGreaterThanOrEqual(6)
      }
    }
  })

  it('says where it came from', () => {
    for (const passage of passages(10)) {
      expect(passage.why.startsWith('Built from ')).toBe(true)
      expect(passage.why.endsWith('.')).toBe(true)
    }
  })

  it('estimates the time honestly', () => {
    // Twenty-three words at a shade under two and a half a second.
    expect(sayingSeconds(new Array(23).fill('word').join(' '))).toBe(10)
    // Nothing at all still reports a floor rather than zero seconds.
    expect(sayingSeconds('   ')).toBe(5)
  })
})
