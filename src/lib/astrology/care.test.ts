import { describe, expect, it } from 'vitest'
import { BREATH_PRESETS } from '../breathing'
import { carePlanOf, NOT_MEDICAL } from './care'
import { buildChart } from './chart'
import { horoscopeOf } from './horoscope'
import { everyString, PROSE_FAULTS } from './prose'

/**
 * The care plan, which is the panel that has to end in something the app can
 * actually do.
 *
 * So the assertions are about *wiring* as much as about words: the breath it
 * suggests has to be a pattern this player already knows, the session has to
 * have a length and a line, and the three questions have to be three
 * questions rather than the same one printed three times.
 */

const LISBON = { latitude: 38.7223, longitude: -9.1393 }

function plans() {
  const chart = buildChart(new Date('1994-07-14T13:30:00Z'), LISBON, true)
  return Array.from({ length: 30 }, (_, day) =>
    carePlanOf(
      chart,
      horoscopeOf(chart, LISBON, new Date(Date.UTC(2026, 1, 1 + day, 9, 0))),
    ),
  )
}

describe('the care plan', () => {
  it('only ever suggests a breath the player already has', () => {
    for (const plan of plans()) {
      expect(BREATH_PRESETS).toContain(plan.breath.preset)
      expect(plan.breath.preset.pattern.inhale).toBeGreaterThan(0)
      expect(plan.breath.preset.pattern.exhale).toBeGreaterThan(0)
    }
  })

  it('asks three different questions', () => {
    for (const plan of plans()) {
      expect(plan.prompts).toHaveLength(3)
      expect(new Set(plan.prompts).size).toBe(3)
    }
  })

  it('hands over a session with a length and a line', () => {
    for (const plan of plans()) {
      expect(plan.session.minutes).toBeGreaterThanOrEqual(5)
      expect(plan.session.minutes).toBeLessThanOrEqual(15)
      expect(plan.session.line.length).toBeGreaterThan(10)
      expect(plan.ritual.steps).toHaveLength(4)
    }
  })

  it('keeps the honest note where somebody will see it', () => {
    for (const plan of plans()) {
      expect(plan.note).toBe(NOT_MEDICAL)
      expect(plan.note).toContain('not medical advice')
    }
  })

  it('writes English, every day of the month', () => {
    for (const plan of plans()) {
      for (const text of everyString(plan)) {
        for (const fault of PROSE_FAULTS) {
          expect(fault.pattern.test(text), `${fault.name}: “${text}”`).toBe(false)
        }
      }
    }
  })
})
