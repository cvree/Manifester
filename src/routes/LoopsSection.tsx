import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { ExportPanel } from '../components/ExportPanel'
import { LeafIcon } from '../components/Icons'
import { ReminderPanel } from '../components/ReminderPanel'
import { SavedLoopCard } from '../components/SavedLoopCard'
import { Sheet } from '../components/Sheet'
import { soundSummary, voiceSummary } from '../lib/summaries'
import { useStudioAvailable } from '../lib/tts/useTTSStatus'
import type { SavedLoop } from '../lib/types'
import { pickBestVoice } from '../lib/voiceRanking'
import { useLibrary } from '../state/LibraryProvider'
import { useSession } from '../state/SessionProvider'

export function LoopsSection() {
  const navigate = useNavigate()
  const { loops, ready, allTracks, removeLoop, duplicateLoop } = useLibrary()
  const { loadIntoDraft, start, voices } = useSession()
  const studioAvailable = useStudioAvailable()
  const [exporting, setExporting] = useState<SavedLoop | null>(null)
  const [reminding, setReminding] = useState<SavedLoop | null>(null)

  const play = (loop: SavedLoop) => {
    loadIntoDraft(loop)
    start(loop)
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
          <p className="type-meta py-8 text-center" role="status" aria-live="polite">
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
              onRemind={() => setReminding(loop)}
              onDuplicate={() => void duplicateLoop(loop.id)}
              onDelete={() => void removeLoop(loop.id)}
            />
          ))}
        </div>
      )}

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
              studioAvailable,
            )}
          />
        )}
      </Sheet>

      <Sheet
        open={reminding != null}
        onClose={() => setReminding(null)}
        title="Calendar reminder"
        description={reminding ? `Choose one time for “${reminding.title}”.` : undefined}
      >
        {reminding && <ReminderPanel loop={reminding} />}
      </Sheet>
    </div>
  )
}
