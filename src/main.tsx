import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
// Lenis needs its own reset to take over scrolling on the About screen.
import 'lenis/dist/lenis.css'
import './styles/theme.css'

// Offline caching. `autoUpdate` means a new version installs quietly and takes
// over on the next launch — no update banner to interrupt a session.
registerSW({ immediate: true })

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
