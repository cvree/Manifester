import { describe, expect, it } from 'vitest'
import { MAX_SPEED, MIN_SPEED } from './cacheKey'
import { STUDIO_PITCH, bridgeRate, clampStudioPitch, voiceShape } from './shape'

/*
 * The one property everything else rests on: the tempo somebody chose is the
 * tempo they get, at every pitch. Pitch is allowed to give at the corners of
 * the range — nobody can name the last two per cent of a pitch shift — but a
 * loop that quietly runs fast because somebody moved a different slider is a
 * loop whose timing has stopped meaning anything.
 */
describe('splitting speed and pitch', () => {
  it('leaves everything alone at pitch 1', () => {
    for (const rate of [0.5, 0.85, 1, 1.25, 1.6]) {
      const shape = voiceShape(rate, 1)
      expect(shape.synthesisSpeed).toBeCloseTo(rate, 5)
      expect(shape.playbackRate).toBeCloseTo(1, 5)
    }
  })

  it('keeps the tempo exact across the whole range', () => {
    for (const rate of [0.5, 0.75, 1, 1.35, 1.6]) {
      for (const pitch of [0.8, 0.9, 1, 1.1, 1.25]) {
        const { synthesisSpeed, playbackRate } = voiceShape(rate, pitch)
        expect(synthesisSpeed * playbackRate).toBeCloseTo(rate, 4)
      }
    }
  })

  it('renders slower to sound higher, and faster to sound lower', () => {
    const high = voiceShape(1, 1.2)
    const low = voiceShape(1, 0.85)
    expect(high.synthesisSpeed).toBeLessThan(1)
    expect(high.playbackRate).toBeGreaterThan(1)
    expect(low.synthesisSpeed).toBeGreaterThan(1)
    expect(low.playbackRate).toBeLessThan(1)
  })

  it('gives the pitch rather than the tempo when the engine runs out of range', () => {
    // The engine cannot render below 0.5×, so this pitch is not fully
    // available at this speed. The tempo must still be right.
    const { synthesisSpeed, playbackRate } = voiceShape(0.5, 1.25)
    expect(synthesisSpeed).toBe(MIN_SPEED)
    expect(synthesisSpeed * playbackRate).toBeCloseTo(0.5, 4)
    expect(playbackRate).toBeLessThan(1.25)
  })

  it('never asks the engine for a speed it does not have', () => {
    for (const rate of [0.5, 1, 1.6]) {
      for (const pitch of [STUDIO_PITCH.min, 1, STUDIO_PITCH.max]) {
        const { synthesisSpeed } = voiceShape(rate, pitch)
        expect(synthesisSpeed).toBeGreaterThanOrEqual(MIN_SPEED)
        expect(synthesisSpeed).toBeLessThanOrEqual(MAX_SPEED)
      }
    }
  })

  it('holds a studio voice inside the range it still sounds human in', () => {
    expect(clampStudioPitch(2)).toBe(STUDIO_PITCH.max)
    expect(clampStudioPitch(0.1)).toBe(STUDIO_PITCH.min)
    expect(clampStudioPitch(Number.NaN)).toBe(1)
  })
})

describe('bending a clip that is already playing', () => {
  it('plays a rendered clip at whatever gives the new tempo', () => {
    // Rendered for 1.0× and now wanted at 1.3×: the buffer has to run 30%
    // faster, which is exactly what makes the change audible with no gap.
    expect(bridgeRate(1.3, 1)).toBeCloseTo(1.3, 5)
    // Rendered slow for a high pitch; the same tempo change is a smaller
    // playback change, because the clip was already being sped up.
    expect(bridgeRate(1.3, 0.87)).toBeCloseTo(1.3 / 0.87, 5)
  })

  it('answers with something playable when there is nothing to measure', () => {
    expect(bridgeRate(1.2, 0)).toBe(1)
    expect(bridgeRate(Number.NaN, 1)).toBe(1)
  })
})
