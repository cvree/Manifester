import { pickLaunchLoop } from './loops'
import type { SavedLoop } from './types'

export function launchDestination(loops: SavedLoop[]): '/player' | '/create' {
  return pickLaunchLoop(loops) ? '/player' : '/create'
}
