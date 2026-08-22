/**
 * The five pieces, and where each one belongs.
 *
 * A soundtrack in an app like this is not a playlist. Nobody chooses a track;
 * the app chooses, from what the person is doing, and the only evidence that
 * any of it happened should be that the room felt right. So the mapping lives
 * here as data — one line per piece — rather than as conditions scattered
 * through the routes.
 *
 * ── The loop points ──
 *
 * `loopSeconds` is the length of the region that repeats, measured from the
 * first sample that is not encoder padding. It is not the length of the file,
 * and the difference is the whole reason these pieces can repeat at all: each
 * one ends by winding down and fading to nothing, and a loop that plays that
 * ending and cuts back to a full-level opening announces itself every time
 * round. The region therefore stops a few seconds before the ending, at the
 * latest moment whose last second and a bit is the same loudness as the
 * opening's — so the seam crossfade has matched material on both sides and
 * measures flat across it.
 *
 * The numbers are measured, not chosen. `node scripts/music-loop-points.mjs`
 * prints this table from the files in `public/music`; the comment beside each
 * one is what that run reported.
 */

/** How long the file is, for the record. Nothing reads it but a human. */
interface Measured {
  fileSeconds: number
}

export type SoundtrackTrackId =
  | 'twilight-sanctuary'
  | 'the-velvet-hour'
  | 'between-two-breaths'
  | 'the-glass-room'
  | 'after-the-sun-recedes'

export interface SoundtrackTrack extends Measured {
  id: SoundtrackTrackId
  /**
   * The piece's name, shown only inside the expanded music settings.
   *
   * Never on the page itself: a permanent "now playing" line would turn an
   * atmosphere into a media player, which is the one thing this must not
   * become.
   */
  title: string
  /** Relative to `public/music`. */
  file: string
  /** The repeating region, in seconds from the first non-silent sample. */
  loopSeconds: number
}

export const SOUNDTRACK_TRACKS: readonly SoundtrackTrack[] = [
  {
    id: 'twilight-sanctuary',
    title: 'Twilight Sanctuary',
    file: 'twilight-sanctuary.mp3',
    fileSeconds: 59.77,
    // keeps 88% · seam +1.08 dB
    loopSeconds: 52.888,
  },
  {
    id: 'the-velvet-hour',
    title: 'The Velvet Hour',
    file: 'the-velvet-hour.mp3',
    fileSeconds: 119.48,
    // keeps 92% · seam +0.00 dB
    loopSeconds: 110.066,
  },
  {
    id: 'between-two-breaths',
    title: 'Between Two Breaths',
    file: 'between-two-breaths.mp3',
    fileSeconds: 180.01,
    // keeps 97% · seam +0.10 dB
    loopSeconds: 175.444,
  },
  {
    id: 'the-glass-room',
    title: 'The Glass Room',
    file: 'the-glass-room.mp3',
    fileSeconds: 58.44,
    // keeps 88% · seam +0.02 dB
    loopSeconds: 51.592,
  },
  {
    id: 'after-the-sun-recedes',
    title: 'After the Sun Recedes',
    file: 'after-the-sun-recedes.mp3',
    fileSeconds: 59.32,
    // keeps 89% · seam −0.04 dB
    loopSeconds: 52.649,
  },
]

export function findTrack(id: SoundtrackTrackId): SoundtrackTrack {
  const track = SOUNDTRACK_TRACKS.find((candidate) => candidate.id === id)
  // The id type makes this unreachable; the throw is what keeps it that way if
  // the table and the union ever drift apart.
  if (!track) throw new Error(`Unknown soundtrack track: ${id}`)
  return track
}

/**
 * Where the file is, honouring the deployment's base path.
 *
 * `import.meta.env.BASE_URL` is `/Manifester/` on GitHub Pages and `/`
 * everywhere else — the same prefix `public/speech` is reached through.
 */
export function trackUrl(track: SoundtrackTrack): string {
  const base = import.meta.env?.BASE_URL ?? '/'
  return `${base}music/${track.file}`
}
