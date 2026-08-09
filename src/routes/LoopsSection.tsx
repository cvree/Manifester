import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { ExportPanel } from '../components/ExportPanel'
import { LeafIcon } from '../components/Icons'
import { SavedLoopCard } from '../components/SavedLoopCard'
import { Sheet } from '../components/Sheet'
import { soundSummary, voiceSummary } from '../lib/summaries'
import type { SavedLoop } from '../lib/types'
import { pickBestVoice } from '../lib/voiceRanking'
import { useLibrary } from '../state/LibraryProvider'
import { useSession } from '../state/SessionProvider'

export function LoopsSection() {
  const navigate = useNavigate()
  const { loops, ready, allTracks, removeLoop, duplicateLoop, touchLoop } =
    useLibrary()
  const { loadIntoDraft, start, voices } = useSession()

  /**
   * The loop whose download sheet is open. Held here rather than in the card
   * so the sheet is a sibling of the grid: one at a time, and never inside a
   * card that is about to re-order itself under it.
   */
  const [exporting, setExporting] = useState<SavedLoop | null>(null)

  const play = (loop: SavedLoop) => {
    loadIntoDraft(loop)
    start(loop)
    void touchLoop(loop.id)
    navigate('/player')
  }

  const edit = (loop: SavedLoop) => {
    loadIntoDraft(loop)
    navigate('/create')
  }

  return (
    <div className="space-y-6">
      {!ready ? (
        <Card data-rise level="panel">
          <p
            className="type-meta py-8 text-center"
            role="status"
            aria-live="polite"
          >
            Opening your library…
          </p>
        </Card>
      ) : loops.length === 0 ? (
        <Card data-rise level="stage">
          <EmptyState
            icon={<LeafIcon />}
            title="No saved loops yet"
            description="When you find wording that settles you, save it here so it is one tap away next time."
            action={
              <Button variant="primary" size="lg" onClick={() => navigate('/create')}>
                Create your first loop
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {loops.map((loop) => (
            <SavedLoopCard
              key={loop.id}
              loop={loop}
              onPlay={() => play(loop)}
              onEdit={() => edit(loop)}
              onDownload={() => setExporting(loop)}
              onDuplicate={() => void duplicateLoop(loop.id)}
              onDelete={() => void removeLoop(loop.id)}
            />
          ))}
        </div>
      )}

      {/*
        The same export panel the Create tab uses, pointed at a saved loop
        instead of the draft — every length, the manifest of what is going in
        the file, the worker, the progress and the WAV fallback included. A
        loop you saved a month ago is exactly as downloadable as the one you
        are writing now, and you do not have to load it back into Create first.
      */}
      <Sheet
        open={exporting != null}
        onClose={() => setExporting(null)}
        title="Download audio"
        description={
          exporting
            ? `Render “${exporting.title}” as a file you can play anywhere.`
            : undefined
        }
      >
        {exporting && (
          <ExportPanel
            settings={exporting}
            title={exporting.title}
            hasRecording={exporting.recordingId != null}
            soundLabel={soundSummary(exporting, allTracks)}
            voiceLabel={voiceSummary(
              exporting,
              exporting.voiceURI
                ? (voices.find((voice) => voice.voiceURI === exporting.voiceURI) ??
                  pickBestVoice(voices, exporting.voiceStyle))
                : pickBestVoice(voices, exporting.voiceStyle),
            )}
          />
        )}
      </Sheet>
    </div>
  )
}
