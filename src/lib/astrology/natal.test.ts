import { describe, expect, it } from 'vitest'
import { buildChart } from './chart'
import { natalAspects, portraitOf } from './natal'
import { everyString, PROSE_FAULTS } from './prose'

/**
 * The portrait, and the two things it must never do.
 *
 * It must never **invent** — an unknown birth time means no rising sign and no
 * houses, said out loud rather than filled in with noon. And it must never
 * produce a sentence that gives away that it was assembled: the prose guards
 * run over a spread of charts because the broken join is always one sign in
 * twelve, and that one will never be the one on screen while somebody looks.
 */

const LISBON = { latitude: 38.7223, longitude: -9.1393 }

/** A dozen charts spread across the century, to hit every sign somewhere. */
function spread() {
  return [
    '1957-03-02T06:15:00Z',
    '1966-02-11T04:00:00Z',
    '1971-08-30T23:45:00Z',
    '1984-12-19T11:05:00Z',
    '1994-07-14T13:30:00Z',
    '1999-05-05T17:20:00Z',
    '2001-09-20T18:00:00Z',
    '2008-01-08T02:40:00Z',
    '2015-10-27T09:10:00Z',
    '2021-06-03T20:25:00Z',
  ].map((when) => buildChart(new Date(when), LISBON, true))
}

describe('the natal portrait', () => {
  it('names the big three, in the order people say them', () => {
    const portrait = portraitOf(spread()[4])
    expect(portrait.trio.map((entry) => entry.key)).toEqual(['sun', 'moon', 'rising'])
    expect(portrait.trio[0].sign).toBe('Cancer')
    expect(portrait.blurred).toBe(false)
  })

  it('leaves the rising sign blank rather than guessing it', () => {
    const untimed = buildChart(new Date('1994-07-14T12:00:00Z'), LISBON, false)
    const portrait = portraitOf(untimed)

    expect(portrait.blurred).toBe(true)
    expect(portrait.trio[2].sign).toBe('Unknown')
    expect(portrait.trio[2].body).toContain('birth time')
    // No houses either, so no placement claims one.
    expect(portrait.placements.every((placement) => placement.house == null)).toBe(true)
    // And no aspects to angles that do not exist.
    expect(
      portrait.aspects.every(
        (aspect) =>
          aspect.a !== 'ascendant' &&
          aspect.b !== 'ascendant' &&
          aspect.a !== 'midheaven' &&
          aspect.b !== 'midheaven',
      ),
    ).toBe(true)
  })

  it('counts a chart the way an astrologer would', () => {
    for (const chart of spread()) {
      const { balance } = portraitOf(chart)
      const total = Object.values(balance.elements).reduce((sum, value) => sum + value, 0)
      // Ten bodies, the two lights counted twice, plus the Ascendant.
      expect(total).toBe(13)
      expect(
        Object.values(balance.modalities).reduce((sum, value) => sum + value, 0),
      ).toBe(13)
    }
  })

  it('ranks the chart’s own aspects, tightest and heaviest first', () => {
    for (const chart of spread()) {
      const aspects = natalAspects(chart, 20)
      for (let index = 1; index < aspects.length; index += 1) {
        expect(aspects[index - 1].significance).toBeGreaterThanOrEqual(
          aspects[index].significance,
        )
      }
      // Natal orbs are held tighter than transiting ones — a permanent aspect
      // that is barely in orb is noise across a life.
      for (const aspect of aspects) {
        expect(aspect.orb).toBeLessThanOrEqual(aspect.kind.orb * 0.72 + 1e-9)
      }
    }
  })

  it('gives every chart both a gift and an edge', () => {
    for (const chart of spread()) {
      const portrait = portraitOf(chart)
      expect(portrait.gifts.length).toBeGreaterThanOrEqual(3)
      expect(portrait.edges.length).toBeGreaterThanOrEqual(3)
      expect(portrait.placements).toHaveLength(10)
    }
  })

  it('writes English, for every chart it is given', () => {
    for (const chart of [...spread(), buildChart(new Date('1988-04-04T12:00:00Z'), null, false)]) {
      for (const text of everyString(portraitOf(chart))) {
        for (const fault of PROSE_FAULTS) {
          expect(fault.pattern.test(text), `${fault.name}: “${text}”`).toBe(false)
        }
      }
    }
  })
})
