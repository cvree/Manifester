import { useEffect, useState } from 'react'
import { defaultReminderValue, downloadCalendarReminder } from '../lib/calendar'
import type { SavedLoop } from '../lib/types'
import { Button } from './Button'
import { ClockIcon } from './Icons'

export function ReminderPanel({ loop }: { loop: SavedLoop }) {
  const [when, setWhen] = useState(defaultReminderValue)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    setWhen(defaultReminderValue())
    setNote(null)
  }, [loop.id])

  const add = () => {
    const date = new Date(when)
    if (!Number.isFinite(date.getTime())) {
      setNote('Choose a date and time first.')
      return
    }
    downloadCalendarReminder(loop, date)
    setNote('Calendar file ready. Your device will ask where to add it.')
  }

  return (
    <div className="space-y-5">
      <p className="type-body">
        This creates one ordinary calendar event. Manifester will not send notifications or ask again.
      </p>
      <label className="block">
        <span className="type-label mb-2 block">Date and time</span>
        <input
          type="datetime-local"
          value={when}
          onChange={(event) => setWhen(event.target.value)}
          className="surface-control min-h-12 w-full px-4 text-ink"
        />
      </label>
      <Button variant="primary" size="lg" onClick={add} leading={<ClockIcon />}>
        Add to calendar
      </Button>
      {note && (
        <p className="type-meta" role="status" aria-live="polite">
          {note}
        </p>
      )}
    </div>
  )
}
