/** The contract between the export UI and the encoding worker. */

export interface EncodeRequest {
  /** Loopable background samples; empty when the loop has no sound. */
  bed: Float32Array
  /** One pass of the recorded voice; empty when there is no recording. */
  voice: Float32Array
  sampleRate: number
  totalSamples: number
  /** Silence after each voice pass. */
  delaySamples: number
  musicVolume: number
  voiceVolume: number
  bitrateKbps: number
  crossfadeSamples: number
  /** Fade in at the start and out at the end. */
  fadeSamples: number
  /**
   * Lifts the finished mix to a sensible listening level without touching the
   * balance the user chose — both layers are scaled by the same amount.
   */
  masterGain: number
}

export type EncodeResponse =
  | { type: 'progress'; percent: number }
  | { type: 'fallback'; reason: string }
  | { type: 'done'; blob: Blob; format: 'mp3' | 'wav' }
  | { type: 'cancelled' }
  | { type: 'failed'; message: string }
