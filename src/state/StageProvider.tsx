/**
 * Whether the player's stage has expanded to fill the screen.
 *
 * One boolean, and it lives above the router for one reason: the shell has to
 * know. When the stage grows, the header, the floating navigation and the
 * page behind it all have to step back — and the shell owns those, while the
 * player owns the decision. Everything else about expanded mode is the
 * player's business and stays there, in `useStageExpansion`.
 */

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface StageContextValue {
  expanded: boolean
  setExpanded: (expanded: boolean) => void
}

const StageContext = createContext<StageContextValue | null>(null)

export function StageProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  const value = useMemo(() => ({ expanded, setExpanded }), [expanded])

  return <StageContext.Provider value={value}>{children}</StageContext.Provider>
}

export function useStage(): StageContextValue {
  const context = useContext(StageContext)
  if (!context) {
    throw new Error('useStage must be used inside <StageProvider>')
  }
  return context
}
