import { Navigate } from 'react-router'
import { Card } from '../components/Card'
import { launchDestination } from '../lib/launch'
import { useLibrary } from '../state/LibraryProvider'
import { useSession } from '../state/SessionProvider'

/** Wait for local data, then put the returning user's likely next tap on screen. */
export function LaunchRoute() {
  const { loops, ready: libraryReady } = useLibrary()
  const { ready: sessionReady } = useSession()

  if (!libraryReady || !sessionReady) {
    return (
      <Card level="panel" className="mx-auto mt-8 max-w-md">
        <p className="type-meta py-7 text-center" role="status">
          Opening your last loop…
        </p>
      </Card>
    )
  }

  return <Navigate to={launchDestination(loops)} replace />
}
