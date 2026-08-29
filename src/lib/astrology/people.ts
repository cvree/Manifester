/**
 * The people somebody has added, and where they are kept.
 *
 * Same promise as everything else in this feature and for a stronger reason:
 * these are birth details that are *not the user's own*. A friend's birthday
 * typed into somebody's phone is a small trust, and the only version of this
 * that deserves it is the one where the data never leaves the device, is never
 * attached to an account, and can be deleted in one press without asking why.
 *
 * So: `localStorage`, a cap on how many can be stored, no identifiers beyond a
 * name the user chose, and a remove that removes.
 */

import { readLocal, removeLocal, writeLocal } from '../storage'
import type { BirthDetails } from './profile'

const KEY = 'astrology.people'

/**
 * Ten is plenty.
 *
 * Not a technical limit — it is a design one. This is a feature for the
 * handful of people whose weather actually matters to somebody's day, and a
 * list of forty is a contact book, which is a different and much worse thing
 * to be holding on somebody's behalf.
 */
export const MAX_PEOPLE = 10

export interface Person {
  id: string
  name: string
  birth: BirthDetails
  addedAt: number
}

export function readPeople(): Person[] {
  const raw = readLocal(KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((entry): entry is Person => {
        if (!entry || typeof entry !== 'object') return false
        const person = entry as Partial<Person>
        return (
          typeof person.id === 'string' &&
          typeof person.name === 'string' &&
          typeof person.birth?.date === 'string' &&
          typeof person.birth?.place?.latitude === 'number'
        )
      })
      .slice(0, MAX_PEOPLE)
  } catch {
    return []
  }
}

function write(people: Person[]): void {
  writeLocal(KEY, JSON.stringify(people.slice(0, MAX_PEOPLE)))
}

export function addPerson(name: string, birth: BirthDetails): Person {
  const person: Person = {
    id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || 'Someone',
    birth,
    addedAt: Date.now(),
  }
  write([...readPeople(), person])
  return person
}

export function updatePerson(id: string, name: string, birth: BirthDetails): void {
  write(
    readPeople().map((person) =>
      person.id === id ? { ...person, name: name.trim() || person.name, birth } : person,
    ),
  )
}

export function removePerson(id: string): void {
  const left = readPeople().filter((person) => person.id !== id)
  if (left.length === 0) removeLocal(KEY)
  else write(left)
}

export function forgetEveryone(): void {
  removeLocal(KEY)
}
