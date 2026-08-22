import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { ExportPanel } from '../components/ExportPanel'
import { LeafIcon } from '../components/Icons'
import { ReminderPanel } from '../components/ReminderPanel'
import { SavedLoopCard } from '../components/SavedLoopCard'
import { Sheet } from '../components/Sheet'
import { cue } from '../lib/feedback'
import { MAX_PLAYED_LOOPS, splitLibrary } from '../lib/loops'
import { soundSummary, voiceSummary } from '../lib/summaries'
import { useStudioAvailable } from '../lib/tts/useTTSStatus'
import type { SavedLoop } from '../lib/types'
import { pickBestVoice } from '../lib/voiceRanking'
import { useLibrary } from '../state/LibraryProvider'
import { useSession } from '../state/SessionProvider'

export function LoopsSection() {
  const navigate = useNavigate()
  const {
    loops,
    ready,
    allTracks,
    removeLoop,
    duplicateLoop,
    keepLoop,
    clearPlayed,
  } = useLibrary()
  const { loadIntoDraft, start, voices } = useSession()
  const studioAvailable = useStudioAvailable()
  const [exporting, setExporting] = useState<SavedLoop | null>(null)
  const [reminding, setReminding] = useState<SavedLoop | null>(null)
  const [clearing, setClearing] = useState(false)

  const { kept, played } = useMemo(() => splitLibrary(loops), [loops])

  const play = (loop: SavedLoop) => {
    loadIntoDraft(loop)
    start(loop)
    navigate('/player')
  }

  const edit = (loop: SavedLoop) => {
    loadIntoDraft(loop)
    navigate('/create')
  }

  const card = (loop: SavedLoop, keepable: boolean) => (
    <SavedLoopCard
      key={loop.id}
      loop={loop}
      onPlay={() => play(loop)}
      onEdit={() => edit(loop)}
      onDownload={() => setExporting(loop)}
      onRemind={() => setReminding(loop)}
      onDuplicate={() => void duplicateLoop(loop.id)}
      onDelete={() => void removeLoop(loop.id)}
      onKeep={keepable ? () => void keepLoop(loop.id) : undefined}
    />
  )

  const forget = () => {
    cue('tap')
    void clearPlayed()
    setClearing(false)
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
            title="No loops yet"
            description="Anything you play lands here on its own. Save the ones worth coming back to and they stay at the top."
            action={
              <Button variant="primary" size="lg" onClick={() => navigate('/create')}>
                Create your first loop
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {/*
            Saved first, always. What somebody took the time to save should
            never be pushed down the page by something they merely pressed
            play on — the headings only appear once both groups exist, so a
            library of saved loops looks exactly as it always did.
          */}
          {kept.length > 0 && (
            <section className="space-y-4">
              {played.length > 0 && (
                <header data-rise>
                  <h2 className="type-label">Saved · {kept.length}</h2>
                  <p className="type-meta mt-1">Yours until you delete them.</p>
                </header>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                {kept.map((loop) => card(loop, false))}
              </div>
            </section>
          )}

          {played.length > 0 && (
            <section className="space-y-4">
              <header
                data-rise
                className="flex flex-wrap items-end justify-between gap-3"
              >
                <div>
                  <h2 className="type-label">Recent plays · {played.length}</h2>
                  <p className="type-meta mt-1 max-w-[46ch]">
                    The last {MAX_PLAYED_LOOPS} you listened to. Save one and it
                    moves up to stay.
                  </p>
                </div>
                {clearing ? (
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setClearing(false)}
                      className="min-h-11 rounded-pill px-3 text-[0.9rem] text-ink-muted"
                    >
                      Keep them
                    </button>
                    <Button variant="danger" size="sm" onClick={forget}>
                      Clear {played.length}
                    </Button>
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      cue('tap')
                      setClearing(true)
                    }}
                  >
                    Clear recent plays
                  </Button>
                )}
              </header>
              <div className="grid gap-4 md:grid-cols-2">
                {played.map((loop) => card(loop, true))}
              </div>
            </section>
          )}
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
