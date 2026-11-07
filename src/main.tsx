import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { deferReload } from './lib/appUpdate'
import { installGlobalErrorLog } from './lib/diagnostics'
// Lenis needs its own reset to take over scrolling on the About screen.
import 'lenis/dist/lenis.css'
import './styles/theme.css'

// Offline caching. `autoUpdate` means a new version installs quietly — no
// update banner to interrupt a session. The reload that puts it on screen is
// held until nothing is playing and the person is returning to the app; see
// `lib/appUpdate.ts`. Without `onNeedReload` the page reloaded the moment a
// deploy landed, mid-breath.
registerSW({ immediate: true, onNeedReload: deferReload })

// Errors that escape everything else are written to a small log on this
// device — never sent anywhere. See `lib/diagnostics.ts`.
installGlobalErrorLog()

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary scope="app">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
