import { Navigate, Route, HashRouter as Router, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import { AboutRoute } from './routes/AboutRoute'
import { CreateRoute } from './routes/CreateRoute'
import { PlayerRoute } from './routes/PlayerRoute'
import { SavedRoute } from './routes/SavedRoute'
import { SoundsRoute } from './routes/SoundsRoute'
import { LibraryProvider } from './state/LibraryProvider'
import { PreferencesProvider } from './state/PreferencesProvider'
import { SessionProvider } from './state/SessionProvider'
import { ThemeProvider } from './state/ThemeProvider'

/**
 * Hash routing on purpose: GitHub Pages serves static files with no rewrite
 * rules, so `/Manifester/saved` would 404 on refresh or on a shared link.
 * `#/saved` always resolves to the one real document. See the README.
 */
export default function App() {
  return (
    <ThemeProvider>
      <PreferencesProvider>
        <LibraryProvider>
          <SessionProvider>
            <Router>
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<Navigate to="/create" replace />} />
                  <Route path="/create" element={<CreateRoute />} />
                  <Route path="/player" element={<PlayerRoute />} />
                  <Route path="/saved" element={<SavedRoute />} />
                  <Route path="/sounds" element={<SoundsRoute />} />
                  <Route path="/about" element={<AboutRoute />} />
                  <Route path="*" element={<Navigate to="/create" replace />} />
                </Route>
              </Routes>
            </Router>
          </SessionProvider>
        </LibraryProvider>
      </PreferencesProvider>
    </ThemeProvider>
  )
}
