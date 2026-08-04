import { useNavigate } from 'react-router'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { LeafIcon } from '../components/Icons'
import { SavedLoopCard } from '../components/SavedLoopCard'
import type { SavedLoop } from '../lib/types'
import { useLibrary } from '../state/LibraryProvider'
import { useSession } from '../state/SessionProvider'

export function SavedRoute() {
  const navigate = useNavigate()
  const { loops, ready, removeLoop, duplicateLoop, touchLoop } = useLibrary()
  const { loadIntoDraft, start } = useSession()

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
    <div className="space-y-5">
      <section data-rise className="pt-2 pb-1">
        <h1 className="font-display text-[2rem] leading-tight text-ink">
          Saved loops
        </h1>
        <p className="mt-2 max-w-[42ch] text-[1rem] leading-relaxed text-ink-muted">
          Your rituals, kept on this device.
        </p>
      </section>

      {!ready ? (
        <Card data-rise>
          <p className="py-6 text-center text-[0.95rem] text-ink-muted">
            Opening your library…
          </p>
        </Card>
      ) : loops.length === 0 ? (
        <Card data-rise>
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
        <div className="space-y-4">
          {loops.map((loop) => (
            <SavedLoopCard
              key={loop.id}
              loop={loop}
              onPlay={() => play(loop)}
              onEdit={() => edit(loop)}
              onDuplicate={() => void duplicateLoop(loop.id)}
              onDelete={() => void removeLoop(loop.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
