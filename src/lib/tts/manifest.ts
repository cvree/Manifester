/**
 * The clips that shipped with the app.
 *
 * `npm run speech` speaks every phrase the app already knows it might say —
 * the starter lines, the writing helper's suggestions, the voice sample — and
 * writes them into `public/speech` along with a manifest. They are ordinary
 * static files: the service worker can precache them, a CDN can serve them,
 * and because their names are content hashes they can be `immutable` forever.
 *
 * The practical effect is that the most common thing anybody hears in this app
 * arrives with no backend involved and no synthesis at all — on the first tap,
 * on a cold cache, on a phone in a lift.
 *
 * A missing manifest is not an error. It is what a build without pre-generated
 * speech looks like, and everything downstream simply misses and moves on.
 */

import type { AudioFormat } from './types'

export interface ManifestClip {
  /** The words, after pronunciation rules — kept for debugging only. */
  text: string
  voice: string
  speed: number
  language: string
  durationSeconds?: number
  /** Paths relative to the manifest's own directory. */
  formats: Partial<Record<AudioFormat, string>>
}

export interface SpeechManifest {
  version: number
  generatedAt?: string
  engine?: { id: string; modelVersion: string }
  versions?: { voice: number; pronunciation: number; audio: number }
  clips: Record<string, ManifestClip>
}

const EMPTY: SpeechManifest = { version: 1, clips: {} }

export class StaticManifest {
  private loaded: Promise<SpeechManifest> | null = null
  private data: SpeechManifest = EMPTY

  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  /**
   * Read the manifest, once.
   *
   * Failures resolve to an empty manifest rather than rejecting: a build with
   * no pre-generated speech, an offline first load, and a 404 from a static
   * host are all the same situation as far as the caller is concerned — there
   * is nothing here, look somewhere else.
   */
  load(): Promise<SpeechManifest> {
    if (this.loaded) return this.loaded
    this.loaded = fetch(`${this.baseUrl}manifest.json`, { cache: 'no-cache' })
      .then((response) => (response.ok ? response.json() : EMPTY))
      .then((json: SpeechManifest) => {
        this.data = json && typeof json === 'object' && json.clips ? json : EMPTY
        return this.data
      })
      .catch(() => {
        this.data = EMPTY
        return EMPTY
      })
    return this.loaded
  }

  /** True once a manifest with clips in it has been read. */
  get hasClips(): boolean {
    return Object.keys(this.data.clips).length > 0
  }

  /**
   * The model version the shipped clips were made with, once the manifest has
   * been read. `null` before that, and on a build with no generated speech.
   */
  get modelVersion(): string | null {
    return this.data.engine?.modelVersion ?? null
  }

  /** The URL of a pre-generated clip, or `null` when it was not generated. */
  async urlFor(key: string, format: AudioFormat): Promise<string | null> {
    const manifest = await this.load()
    const clip = manifest.clips[key]
    const path = clip?.formats?.[format]
    return path ? `${this.baseUrl}${path}` : null
  }
}
