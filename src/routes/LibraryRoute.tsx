import { Suspense, lazy, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { LibraryBackupPanel } from '../components/LibraryBackupPanel'
import { SegmentedControl } from '../components/SegmentedControl'
import { readAstrology } from '../lib/astrology/profile'
import { cue } from '../lib/feedback'
import { listeningSentence } from '../lib/listening'
import { useLibrary } from '../state/LibraryProvider'
import { LoopsSection } from './LoopsSection'
import { SoundsSection } from './SoundsSection'

/**
 * Split off, and the reason is a promise rather than a byte count.
 *
 * The astrology feature is told to people as "nothing is downloaded unless you
 * ask for it", and that has to be true of the code as well as the data: the
 * ephemeris, the interpretations, the portrait, the cycles and two hundred
 * cities are a good deal of text that somebody who said "not for me" should
 * never receive. Loading it when the tab is opened makes the sentence honest.
 */
const AstrologySection = lazy(() =>
  import('./AstrologySection').then((module) => ({
    default: module.AstrologySection,
  })),
)

type Half = 'loops' | 'sounds' | 'astrology'

export function LibraryRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loops, allTracks, listeningStats } = useLibrary()
  const fromUrl = new URLSearchParams(location.search).get('show')
  const [half, setHalf] = useState<Half>(() => readSection(fromUrl))

  /**
   * Whether the third tab exists at all.
   *
   * Somebody who declined the chart in onboarding should see no trace of it
   * here — a tab they have already said no to is the app asking twice. Read
   * once on mount rather than subscribed to, because the only thing that can
   * change it from `declined` is the Settings screen, which is a navigation
   * away and therefore a remount.
   */
  const [astrology, setAstrology] = useState(() => readAstrology().status)

  useEffect(() => {
    setHalf(readSection(fromUrl))
  }, [fromUrl])

  useEffect(() => {
    // The Astrology tab can be reached directly by URL from Settings, and
    // arriving that way is itself a change of mind worth honouring.
    if (fromUrl === 'astrology' || fromUrl === 'sky') {
      setAstrology(readAstrology().status)
    }
  }, [fromUrl])

  const show = (next: Half) => {
    cue('select')
    setHalf(next)
    navigate(next === 'loops' ? '/library' : `/library?show=${next}`, {
      replace: true,
    })
  }

  const total = listeningSentence(listeningStats)
  const showAstrology = astrology !== 'declined'
  const section = half === 'astrology' && !showAstrology ? 'loops' : half

  return (
    <div className="mx-auto max-w-2xl space-y-6 md:max-w-5xl">
      {/*
        No paragraph naming the three things in the library: the tabs directly
        under this heading already name them, and a sentence that lists the
        buttons below it is a caption for a picture you can see.
      */}
      <header data-rise className="pt-2">
        <h1 className="type-display">Your library</h1>
        <p className="type-body mt-3 max-w-[52ch]">
          {total ?? 'Everything here stays on this device.'}
        </p>
      </header>

      <div data-rise>
        <SegmentedControl
          label="Library section"
          value={section}
          onChange={show}
          className={showAstrology ? 'max-w-md' : 'max-w-sm'}
          segments={[
            {
              value: 'loops',
              label: loops.length > 0 ? `Loops · ${loops.length}` : 'Loops',
            },
            { value: 'sounds', label: `Sounds · ${allTracks.length}` },
            ...(showAstrology
              ? [{ value: 'astrology' as const, label: 'Astrology' }]
              : []),
          ]}
        />
      </div>

      {section === 'loops' && <LoopsSection />}
      {section === 'sounds' && <SoundsSection />}
      {section === 'astrology' && (
        <Suspense
          fallback={
            <p className="type-meta" role="status">
              Working out where everything is…
            </p>
          }
        >
          <AstrologySection />
        </Suspense>
      )}

      {/*
        Last, not first. Backing up is a now-and-then errand, and it used to be
        the largest thing on the screen — a card about a file, above the loops
        somebody actually opened this page to reach.
      */}
      <LibraryBackupPanel />
    </div>
  )
}

function readSection(value: string | null): Half {
  if (value === 'sounds') return 'sounds'
  // `sky` is what this section used to be called, and links to it are still in
  // the wild — in somebody's history, in a bookmark, in an older build's
  // Settings screen. It costs one line to keep them working.
  if (value === 'astrology' || value === 'sky') return 'astrology'
  return 'loops'
}
