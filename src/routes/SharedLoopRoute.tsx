import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { LeafIcon, PlayIcon, SeedIcon } from '../components/Icons'
import { decodeSharedLoop } from '../lib/share'
import { useLibrary } from '../state/LibraryProvider'
import { useSession } from '../state/SessionProvider'

export function SharedLoopRoute() {
  const location = useLocation()
  const navigate = useNavigate()
  const { saveLoop } = useLibrary()
  const { loadIntoDraft } = useSession()
  const [saving, setSaving] = useState(false)

  const result = useMemo(() => {
    const token = new URLSearchParams(location.search).get('loop') ?? ''
    try {
      return { loop: decodeSharedLoop(token), error: null }
    } catch (error) {
      return {
        loop: null,
        error: error instanceof Error ? error.message : 'This shared link is not valid.',
      }
    }
  }, [location.search])

  if (!result.loop) {
    return (
      <Card level="stage" className="mx-auto mt-8 max-w-xl">
        <EmptyState
          icon={<LeafIcon />}
          title="This loop could not be opened"
          description={result.error ?? 'The link may be incomplete or from a newer version.'}
          action={<Button onClick={() => navigate('/create')}>Create your own loop</Button>}
        />
      </Card>
    )
  }

  const loop = result.loop
  const useNow = () => {
    loadIntoDraft(loop)
    navigate('/player')
  }
  const saveAndUse = async () => {
    if (saving) return
    setSaving(true)
    try {
      await saveLoop(loop)
      loadIntoDraft(loop)
      navigate('/player')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-2">
      <header data-rise>
        <p className="type-label">Shared with you</p>
        <h1 className="type-display mt-2">{loop.title}</h1>
        <p className="type-body mt-3 max-w-[48ch]">
          Nothing was uploaded to Manifester. The words and portable settings are carried in this link.
        </p>
      </header>
      <Card data-rise level="stage">
        <p className="max-h-[18rem] overflow-y-auto whitespace-pre-line font-display text-[1.18rem] leading-relaxed text-ink">
          {loop.text}
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Button
            variant="primary"
            size="lg"
            onClick={useNow}
            leading={<PlayIcon />}
          >
            Use now
          </Button>
          <Button
            variant="secondary"
            size="lg"
            loading={saving}
            onClick={() => void saveAndUse()}
            leading={<SeedIcon />}
          >
            Save to my library
          </Button>
        </div>
      </Card>
    </div>
  )
}
