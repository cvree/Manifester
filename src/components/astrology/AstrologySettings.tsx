import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  declineAstrology,
  forgetAstrology,
  readAstrology,
  writeAstrology,
} from '../../lib/astrology/profile'
import { cue } from '../../lib/feedback'
import { Button } from '../Button'
import { BirthDetailsForm } from './BirthDetailsForm'

/**
 * The chart, from Settings.
 *
 * This is the half of the feature that makes skipping it in onboarding a
 * genuinely free choice rather than a one-way door. Somebody who said "not for
 * me" in January and finds themselves curious in March needs one obvious place
 * to go, and the same is true in the other direction: the fastest, plainest
 * way to remove a birth date from a device has to be here too, next to the
 * thing that put it there.
 *
 * Both directions are one press, neither asks for a reason, and removing is
 * exactly as easy as adding — which is the only version of "you can change
 * your mind" that is actually true.
 */
export function AstrologySettings() {
  const navigate = useNavigate()
  const [state, setState] = useState(() => readAstrology())
  const [editing, setEditing] = useState(false)

  const refresh = () => setState(readAstrology())

  if (state.status === 'ready' && !editing) {
    const { birth } = state.profile
    return (
      <div>
        <p className="type-body">
          Set up for{' '}
          {new Date(`${birth.date}T12:00:00`).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          {birth.time ? ` at ${birth.time}` : ' · time unknown'} in {birth.place.name}.
          Your reading is in the library, under Sky.
        </p>
        <div className="mt-3.5 flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              cue('tap')
              navigate('/library?show=sky')
            }}
          >
            Open my sky
          </Button>
          <Button
            size="md"
            onClick={() => {
              cue('tap')
              setEditing(true)
            }}
          >
            Change details
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              cue('tap')
              forgetAstrology()
              refresh()
            }}
          >
            Remove from this device
          </Button>
        </div>
      </div>
    )
  }

  if (state.status === 'declined' && !editing) {
    return (
      <div>
        <p className="type-body">
          Turned off. Nothing about it appears anywhere in the app, and none of
          the astrology code is downloaded to this device.
        </p>
        <Button
          size="md"
          className="mt-3.5"
          onClick={() => {
            cue('tap')
            setEditing(true)
          }}
        >
          Actually, set it up
        </Button>
      </div>
    )
  }

  return (
    <div>
      {!editing && (
        <p className="type-body mb-4">
          A birth date, a time and a city, and Manifester works out where every
          planet was — then, each morning, what has moved since and one thing to
          strengthen today. It appears in your library under Sky and nowhere
          else.
        </p>
      )}

      <BirthDetailsForm
        initial={state.status === 'ready' ? state.profile.birth : null}
        saveLabel={state.status === 'ready' ? 'Save changes' : 'Set it up'}
        onSave={(birth) => {
          writeAstrology(birth)
          setEditing(false)
          refresh()
        }}
        secondary={
          editing && state.status === 'ready' ? (
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                cue('tap')
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                cue('tap')
                declineAstrology()
                setEditing(false)
                refresh()
              }}
            >
              Not for me
            </Button>
          )
        }
      />
    </div>
  )
}
