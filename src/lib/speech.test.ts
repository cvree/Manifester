import { describe, expect, it } from 'vitest'
import { LIVE_VOICE_VOLUME_CAP, MAX_VOICE_VOLUME } from './speech'

describe('voice volume ceilings', () => {
  it('lets the setting go above what the live voice can actually reach', () => {
    // `MAX_VOICE_VOLUME` bounds the setting (and so the slider, and an
    // exported recording's gain). `LIVE_VOICE_VOLUME_CAP` is the browser's own
    // hard limit on `SpeechSynthesisUtterance.volume` — nothing in this app can
    // raise that ceiling, because speech synthesis never touches a Web Audio
    // node this app controls.
    expect(LIVE_VOICE_VOLUME_CAP).toBe(1)
    expect(MAX_VOICE_VOLUME).toBeGreaterThan(LIVE_VOICE_VOLUME_CAP)
    expect(MAX_VOICE_VOLUME).toBeCloseTo(2)
  })
})
