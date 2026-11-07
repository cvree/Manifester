import { useState } from 'react'
import { clearDiagnostics, diagnosticsReport, readDiagnostics } from '../lib/diagnostics'
import { Button } from './Button'

/**
 * The on-device error log, for the one moment it is useful: somebody saying
 * "it stopped working last night" and being able to send what happened.
 *
 * Nothing here is sent anywhere. Copying puts the text on the clipboard, and
 * what happens to it after that is the person's decision.
 */
export function DiagnosticsPanel() {
  const [count, setCount] = useState(() => readDiagnostics().length)
  const [notice, setNotice] = useState<string | null>(null)

  const copy = async () => {
    const text = diagnosticsReport()
    try {
      await navigator.clipboard.writeText(text)
      setNotice('Copied. Paste it into a message if you want to send it.')
    } catch {
      setNotice('Copying is blocked here. Long-press to select the text below instead.')
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[0.95rem] leading-relaxed text-ink-muted">
        {count === 0
          ? 'Nothing has gone wrong on this device that the app has noticed.'
          : `${count} ${count === 1 ? 'problem' : 'problems'} noted on this device. The log stays here unless you copy it.`}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void copy()}>
          Copy the log
        </Button>
        {count > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              clearDiagnostics()
              setCount(0)
              setNotice('Cleared.')
            }}
          >
            Clear it
          </Button>
        )}
      </div>
      {notice && (
        <p className="type-meta" role="status">
          {notice}
        </p>
      )}
    </div>
  )
}
