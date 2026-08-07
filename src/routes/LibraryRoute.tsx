import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { SegmentedControl } from '../components/SegmentedControl'
import { cue } from '../lib/feedback'
import { useLibrary } from '../state/LibraryProvider'
import { LoopsSection } from './LoopsSection'
import { SoundsSection } from './SoundsSection'

/**
 * Everything that is *yours*, under one tab.
 *
 * Saved loops and sounds used to be two separate destinations, which meant
 * five things in the navigation and two screens that answered the same
 * question — "what have I got?". They are one place now, and the app is down
 * to three tabs: write it, play it, keep it.
 *
 * Which half you are looking at lives in the URL (`#/library?show=sounds`),
 * so a link to your sounds is still a link to your sounds and the back button
 * behaves the way it reads.
 */
type Half = 'loops' | 'sounds'

export function LibraryRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loops, allTracks } = useLibrary()

  const fromUrl = new URLSearchParams(location.search).get('show')
  const [half, setHalf] = useState<Half>(fromUrl === 'sounds' ? 'sounds' : 'loops')

  useEffect(() => {
    setHalf(fromUrl === 'sounds' ? 'sounds' : 'loops')
  }, [fromUrl])

  const show = (next: Half) => {
    cue('select')
    setHalf(next)
    navigate(next === 'sounds' ? '/library?show=sounds' : '/library', {
      replace: true,
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 md:max-w-5xl">
      <header data-rise className="pt-2">
        <h1 className="type-display">Your library</h1>
        <p className="type-body mt-3 max-w-[52ch]">
          The loops you have saved and the sounds they rest on. All of it stays
          on this device.
        </p>
      </header>

      <div data-rise>
        <SegmentedControl
          label="Library section"
          value={half}
          onChange={show}
          className="max-w-sm"
          segments={[
            {
              value: 'loops',
              label: loops.length > 0 ? `Loops · ${loops.length}` : 'Loops',
            },
            { value: 'sounds', label: `Sounds · ${allTracks.length}` },
          ]}
        />
      </div>

      {half === 'loops' ? <LoopsSection /> : <SoundsSection />}
    </div>
  )
}
