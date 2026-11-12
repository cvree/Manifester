import { afterEach, describe, expect, it } from 'vitest'
import { isGamerMode, motionLevel, prefersReducedMotion, setAppMotion, setGamerMode } from './motion'
import { tts } from './tts'

afterEach(() => {
  setGamerMode(false)
  setAppMotion('full')
  tts.setLightweight(false)
})

describe('gamer mode', () => {
  it('holds the app still whatever the Motion setting says', () => {
    setAppMotion('full')
    expect(prefersReducedMotion()).toBe(false)
    setGamerMode(true)
    expect(isGamerMode()).toBe(true)
    expect(prefersReducedMotion()).toBe(true)
    expect(motionLevel()).toBe('still')
  })

  it('gives the Motion setting back when it is switched off', () => {
    setAppMotion('gentle')
    setGamerMode(true)
    setGamerMode(false)
    expect(motionLevel()).toBe('gentle')
  })

  it('stops the voice synthesising on this device, and says so', () => {
    tts.setLightweight(true)
    expect(tts.isLightweight).toBe(true)
    expect(tts.getStatus().unlimited).toBe(false)
    tts.setLightweight(false)
    expect(tts.isLightweight).toBe(false)
  })
})
