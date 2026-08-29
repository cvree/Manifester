import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildChart } from './chart'
import { bondBetween } from './bonds'
import { everyString, PROSE_FAULTS } from './prose'

/*
 * `people.ts` writes to `localStorage`, which does not exist in a Node test
 * run. The interesting behaviour is not the browser API — it is the promises
 * the module makes about somebody else's birth details: they round-trip, the
 * list is capped, and removing genuinely removes.
 */
const store = vi.hoisted(() => ({ values: new Map<string, string>() }))

vi.mock('../storage', () => ({
  readLocal: (key: string) => store.values.get(key) ?? null,
  writeLocal: (key: string, value: string) => store.values.set(key, value),
  removeLocal: (key: string) => store.values.delete(key),
}))

import { addPerson, forgetEveryone, MAX_PEOPLE, readPeople, removePerson } from './people'

const LISBON = { latitude: 38.7223, longitude: -9.1393 }
const PLACE = {
  name: 'Lisbon',
  country: 'Portugal',
  latitude: 38.7223,
  longitude: -9.1393,
  timeZone: 'Europe/Lisbon',
}

const mine = buildChart(new Date('1994-07-14T13:30:00Z'), LISBON, true)
const theirs = buildChart(new Date('1991-11-03T09:20:00Z'), LISBON, true)

describe('two charts, side by side', () => {
  it('scores every axis inside honest bounds', () => {
    const bond = bondBetween(mine, theirs, 'Alex')
    expect(bond.scores).toHaveLength(5)
    for (const score of bond.scores) {
      expect(score.value).toBeGreaterThanOrEqual(14)
      expect(score.value).toBeLessThanOrEqual(94)
    }
  })

  it('ranks the contacts and keeps the list short enough to read', () => {
    const bond = bondBetween(mine, theirs, 'Alex')
    expect(bond.contacts.length).toBeLessThanOrEqual(6)
    for (let index = 1; index < bond.contacts.length; index += 1) {
      expect(bond.contacts[index - 1].significance).toBeGreaterThanOrEqual(
        bond.contacts[index].significance,
      )
    }
  })

  it('never treats two identical Moons as a difference', () => {
    // Both charts have the Moon in Libra, so the paragraph about how each
    // person settles must not claim they settle differently.
    const bond = bondBetween(mine, theirs, 'Alex')
    expect(bond.moons).toContain('You both have the Moon in Libra')
    expect(bond.moons).not.toContain('That difference')
  })

  it('says something for two charts that barely touch', () => {
    const distant = buildChart(new Date('1962-03-17T05:05:00Z'), LISBON, true)
    const bond = bondBetween(mine, distant, 'Sam')
    expect(bond.works.length).toBeGreaterThan(0)
    expect(bond.watch.length).toBeGreaterThan(0)
    expect(bond.sharedLine.length).toBeGreaterThan(10)
  })

  it('writes English about anybody', () => {
    for (const when of [
      '1962-03-17T05:05:00Z',
      '1979-11-03T02:10:00Z',
      '1991-11-03T09:20:00Z',
      '2004-06-21T22:45:00Z',
    ]) {
      const bond = bondBetween(mine, buildChart(new Date(when), LISBON, true), 'Alex')
      for (const text of everyString(bond)) {
        for (const fault of PROSE_FAULTS) {
          expect(fault.pattern.test(text), `${fault.name}: “${text}”`).toBe(false)
        }
      }
    }
  })
})

describe('the people somebody has added', () => {
  beforeEach(() => {
    store.values.clear()
  })

  it('round-trips a person and forgets them on request', () => {
    const added = addPerson('Alex', { date: '1991-11-03', time: '09:20', place: PLACE })

    expect(readPeople()).toHaveLength(1)
    expect(readPeople()[0].name).toBe('Alex')
    expect(readPeople()[0].birth.time).toBe('09:20')

    removePerson(added.id)
    expect(readPeople()).toHaveLength(0)
    // Nothing left behind on disk once the last one goes.
    expect(store.values.size).toBe(0)
  })

  it('keeps the list to a handful, not a contact book', () => {
    for (let index = 0; index < MAX_PEOPLE + 4; index += 1) {
      addPerson(`Person ${index}`, { date: '1990-01-01', time: null, place: PLACE })
    }
    expect(readPeople()).toHaveLength(MAX_PEOPLE)
  })

  it('survives nonsense on disk rather than throwing', () => {
    store.values.set('manifester:astrology.people', '{ not json')
    expect(readPeople()).toEqual([])

    store.values.set('manifester:astrology.people', JSON.stringify([{ id: 'x' }]))
    expect(readPeople()).toEqual([])
  })

  it('takes everybody with it when the chart is removed', () => {
    addPerson('Alex', { date: '1991-11-03', time: null, place: PLACE })
    forgetEveryone()
    expect(readPeople()).toHaveLength(0)
  })
})
