/**
 * The care plan: what today's sky suggests doing with a body, a nervous system
 * and an evening.
 *
 * ── Why this belongs in a breathing app and not in a horoscope ──────────────
 *
 * Because this is the half of astrology that has always been practical. Long
 * before it was a personality quiz it was a calendar for when to rest, when to
 * plant, and which part of a body to leave alone this week — and while the
 * medicine in that tradition is long superseded, the *structure* is exactly
 * what a daily practice app is short of: a reason to do the small thing today,
 * and a different small thing tomorrow.
 *
 * So every reading here ends in something with a verb in it, and everything it
 * suggests is something this app can actually start: a breath pattern the
 * player already knows, a session length, a line to say, a prompt to write
 * against. It is a doorway into the practice rather than a paragraph about
 * wellness.
 *
 * ── The line this does not cross ────────────────────────────────────────────
 *
 * Nothing here diagnoses, treats or predicts anything about a body. The sign
 * correspondences are used the way they are actually useful — as *attention
 * prompts*, because "your jaw has been clenched since Tuesday" is a genuinely
 * helpful question to be asked and costs nothing if it is wrong — and the
 * screen says so in plain words where nobody can miss it. Anything that would
 * need a doctor to correct it has been cut, and `NOT_MEDICAL` below is
 * rendered on the page rather than hidden in a footer.
 */

import { BREATH_PRESETS, type BreathPreset } from '../breathing'
import { placementOf, type Chart } from './chart'
import { BODY_LORE, ELEMENT_CARE, phaseLore, SIGN_LORE } from './lore'
import { BODY_PROFILES, ELEMENT_LABEL } from './signs'
import type { Horoscope } from './horoscope'

export const NOT_MEDICAL =
  'This is a prompt to pay attention, not medical advice. Astrology has an old habit of pairing signs with parts of the body; it is used here because “check whether your shoulders are up by your ears” is a useful question, not because the sky knows anything about your health. Anything that hurts belongs with a doctor.'

export interface CareStep {
  title: string
  text: string
  /** The one thing to actually do. */
  action: string
}

export interface CarePlan {
  /** What to notice in the body today. */
  attention: CareStep
  /** The breath pattern the day calls for, and why. */
  breath: { preset: BreathPreset; why: string }
  /** How to rest tonight, from the phase of the Moon. */
  rest: CareStep
  /** Three small physical suggestions. */
  movement: string
  nourish: string
  sensory: string
  /** What the heart needs, from the natal Moon rather than from today. */
  emotional: CareStep
  /** A four-step practice for today, in order. */
  ritual: { title: string; steps: string[] }
  /** Three questions worth writing against. */
  prompts: string[]
  /** What a session today might be: how long, and what to say. */
  session: { minutes: number; label: string; line: string }
  note: string
}

/**
 * Which breath the day asks for.
 *
 * Ordered by what is most out of balance rather than by what is prettiest: a
 * day with friction in it gets the long exhale whatever element it is in,
 * because a settled nervous system is the precondition for everything else on
 * this screen. Only once nothing is urgent does the element get to choose.
 */
function breathFor(horoscope: Horoscope): { preset: BreathPreset; why: string } {
  const calm = horoscope.dials.find((dial) => dial.key === 'calm')?.value ?? 50
  const energy = horoscope.dials.find((dial) => dial.key === 'energy')?.value ?? 50
  const element = placementOf(horoscope.sky, 'moon').sign.element

  const find = (id: string) =>
    BREATH_PRESETS.find((preset) => preset.id === id) ?? BREATH_PRESETS[0]

  if (calm < 42) {
    return {
      preset: find('sigh'),
      why: 'There is friction in the sky today, so the long out-breath comes first. Everything else here works better on the other side of five of these.',
    }
  }
  if (energy < 38) {
    return {
      preset: find('awaken'),
      why: 'A low-energy sky. A longer in-breath than out lifts you rather than settling you, which is the direction today needs.',
    }
  }
  return {
    preset: find(ELEMENT_CARE[element].breath),
    why: `The Moon is in ${ELEMENT_LABEL[element].toLowerCase()}, and this one is ${ELEMENT_CARE[element].breathWhy}.`,
  }
}

export function carePlanOf(natal: Chart, horoscope: Horoscope): CarePlan {
  const skyMoon = placementOf(horoscope.sky, 'moon')
  const natalMoon = placementOf(natal, 'moon')
  const natalSun = placementOf(natal, 'sun')

  const todayLore = SIGN_LORE[skyMoon.sign.name]
  const mineLore = SIGN_LORE[natalMoon.sign.name]
  const sunLore = SIGN_LORE[natalSun.sign.name]
  const phase = phaseLore(horoscope.sky.phase.name)
  const element = ELEMENT_CARE[skyMoon.sign.element]

  const breath = breathFor(horoscope)

  const leading = horoscope.reading.highlights[0]?.transit ?? null

  return {
    attention: {
      title: `Where the attention goes today`,
      text: `The Moon is in ${skyMoon.sign.name}, which traditionally puts the attention on ${todayLore.body}. Your own Sun is in ${natalSun.sign.name}, so the standing version of this for you is ${sunLore.body}. Neither is a prediction — both are places worth checking on before the day gets away from you.`,
      action: todayLore.care,
    },
    breath,
    rest: {
      title: `Tonight, with the Moon ${horoscope.sky.phase.waxing ? 'filling' : 'emptying'}`,
      text: `${horoscope.sky.phase.name}, ${Math.round(
        horoscope.sky.phase.illumination * 100,
      )}% lit. ${phase.rest}`,
      action:
        horoscope.sky.phase.illumination > 0.9
          ? 'Get the screens off an hour earlier than usual tonight. Sleep is genuinely thinner around a full moon, and planning for it beats arguing with it.'
          : 'Put the lights low for the last half hour, and let the day finish before you lie down in it.',
    },
    movement: element.movement,
    nourish: element.nourish,
    sensory: element.sensory,
    emotional: {
      title: `What your heart is actually asking for`,
      text: `Your Moon is in ${natalMoon.sign.name}: what settles you — reliably, on the worst days, whatever else is going on — is ${mineLore.needs}. ${BODY_LORE.moon.about} When you are running low, the first thing to check is whether you have had any of that this week.`,
      action: mineLore.ritual,
    },
    ritual: {
      title: 'A five-minute version, in order',
      steps: [
        `${breath.preset.name}: ${breath.preset.description} Five rounds, before anything else.`,
        todayLore.care,
        `Say it once, out loud: “${horoscope.reading.affirmation}”`,
        phase.doThis,
      ],
    },
    /*
     * Three *different* questions. The horoscope's own prompt is drawn from
     * the same pool as the two below it, so without the filter a day lands
     * here asking the identical thing twice — which reads as a bug even when
     * the answer to it is worth writing.
     */
    prompts: [
      ...new Set([
        horoscope.ask,
        mineLore.question,
        leading ? BODY_LORE[leading.from].question : phase.question,
        phase.question,
        sunLore.question,
      ]),
    ].slice(0, 3),
    session: {
      /*
       * Longer on a charged day, shorter on an easy one — because the days
       * somebody least wants to sit down are the days it does the most, and a
       * suggestion of twelve minutes on a hard Tuesday is more honest than the
       * same five minutes every day regardless of what is happening.
       */
      minutes: horoscope.reading.weatherWord === 'Charged' ? 12 : horoscope.reading.weatherWord === 'Quiet' ? 5 : 8,
      label: `${horoscope.reading.focus.label} · ${
        leading ? BODY_PROFILES[leading.from].name : skyMoon.sign.name
      }`,
      line: horoscope.reading.affirmation,
    },
    note: NOT_MEDICAL,
  }
}
