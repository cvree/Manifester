import { useRef, useState } from 'react'
import { useLibrary } from '../state/LibraryProvider'
import { Button } from './Button'
import { Card } from './Card'
import { DownloadIcon, UploadIcon } from './Icons'

export function LibraryBackupPanel() {
  const { createBackup, restoreBackup } = useLibrary()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const backup = async () => {
    if (busy) return
    setBusy('backup')
    setNote(null)
    try {
      const text = await createBackup()
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `manifester-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setNote('Backup saved. Keep that file somewhere you trust.')
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'The backup could not be created.')
    } finally {
      setBusy(null)
    }
  }

  const restore = async (file: File) => {
    if (busy) return
    setBusy('restore')
    setNote(null)
    try {
      const result = await restoreBackup(await file.text())
      setNote(
        result.added === 0
          ? 'Everything in that backup is already here.'
          : `Restored ${result.added} ${result.added === 1 ? 'item' : 'items'}. Nothing already here was replaced.`,
      )
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'That backup could not be restored.')
    } finally {
      setBusy(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <Card
      data-rise
      level="panel"
      title="Keep a backup"
      description="One local file holds every loop, sound and recording here. Restoring merges into what you have; it never replaces it."
    >
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => void backup()}
          loading={busy === 'backup'}
          leading={<DownloadIcon />}
        >
          Back up library
        </Button>
        <Button
          variant="secondary"
          disabled={busy != null}
          onClick={() => inputRef.current?.click()}
          leading={<UploadIcon />}
        >
          Restore backup
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void restore(file)
          }}
        />
      </div>
      {note && (
        <p className="type-meta mt-4" role="status" aria-live="polite">
          {note}
        </p>
      )}
    </Card>
  )
}
