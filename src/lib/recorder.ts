/**
 * Recording your own voice.
 *
 * This exists because of a hard browser limitation: **speech synthesis output
 * cannot be captured by a web page.** `SpeechSynthesisUtterance` is rendered by
 * the operating system straight to the audio device — it never passes through
 * anything a page can tap. There is no MediaStream, no AudioNode, no
 * MediaRecorder path to it, on any browser. So an exported file can never
 * contain the app's spoken voice.
 *
 * What a page absolutely can record is a microphone. Recording your own voice
 * saying your own words is both technically honest and, for this app, rather
 * nicer than a synthesised one.
 */

import { releaseRecordingSession } from './audioSession'

export interface RecorderHandlers {
  /** 0 → 1, for the level meter. */
  onLevel?: (level: number) => void
  onError?: (message: string) => void
}

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices?.getUserMedia != null &&
    typeof MediaRecorder !== 'undefined'
  )
}

/** The first container this browser will actually give us. */
function pickMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4', // Safari
    'audio/ogg;codecs=opus',
  ]
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type))
}

export class VoiceRecorder {
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: BlobPart[] = []
  private analyser: AnalyserNode | null = null
  private ctx: AudioContext | null = null
  private levelFrame = 0
  private handlers: RecorderHandlers = {}
  private startedAt = 0

  get isRecording(): boolean {
    return this.recorder?.state === 'recording'
  }

  get elapsedSeconds(): number {
    return this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0
  }

  async start(handlers: RecorderHandlers = {}): Promise<void> {
    this.handlers = handlers

    if (!isRecordingSupported()) {
      throw new Error('This browser cannot record audio.')
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    const mimeType = pickMimeType()
    this.recorder = new MediaRecorder(
      this.stream,
      mimeType ? { mimeType } : undefined,
    )
    this.chunks = []

    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data)
    }
    this.recorder.onerror = () =>
      this.handlers.onError?.('Recording stopped unexpectedly.')

    this.startedAt = Date.now()
    this.recorder.start(250)
    this.startLevelMeter()
  }

  /** Resolves with the recording, or `null` if nothing was captured. */
  stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const recorder = this.recorder
      if (!recorder || recorder.state === 'inactive') {
        this.cleanup()
        resolve(null)
        return
      }

      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm'
        const blob = this.chunks.length ? new Blob(this.chunks, { type }) : null
        this.cleanup()
        resolve(blob)
      }

      recorder.stop()
    })
  }

  cancel(): void {
    try {
      this.recorder?.stop()
    } catch {
      /* already stopped */
    }
    this.chunks = []
    this.cleanup()
  }

  private startLevelMeter(): void {
    if (!this.stream || !this.handlers.onLevel) return

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return

    this.ctx = new Ctor()
    const source = this.ctx.createMediaStreamSource(this.stream)
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 512
    source.connect(this.analyser)

    const data = new Uint8Array(this.analyser.frequencyBinCount)
    const read = () => {
      if (!this.analyser) return
      this.analyser.getByteTimeDomainData(data)

      // Peak deviation from silence reads better on a meter than RMS.
      let peak = 0
      for (const sample of data) {
        peak = Math.max(peak, Math.abs(sample - 128) / 128)
      }
      this.handlers.onLevel?.(Math.min(1, peak * 1.6))
      this.levelFrame = requestAnimationFrame(read)
    }
    this.levelFrame = requestAnimationFrame(read)
  }

  private cleanup(): void {
    cancelAnimationFrame(this.levelFrame)
    this.analyser = null
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined)
      this.ctx = null
    }
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.recorder = null
    this.startedAt = 0
    // Give the audio route back, or iOS keeps playback in the recording
    // category — quieter, and sometimes out of the earpiece.
    releaseRecordingSession()
  }
}

/** Turn a getUserMedia rejection into something worth reading. */
export function describeRecordingError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Microphone access was blocked. Allow it in your browser settings and try again.'
    }
    if (error.name === 'NotFoundError') {
      return 'No microphone was found on this device.'
    }
    if (error.name === 'NotReadableError') {
      return 'The microphone is already in use by another app.'
    }
  }
  return error instanceof Error
    ? error.message
    : 'The recording could not be started.'
}
