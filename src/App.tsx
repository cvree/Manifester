import { Navigate, Route, HashRouter as Router, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import { AboutRoute } from './routes/AboutRoute'
import { CreateRoute } from './routes/CreateRoute'
import { LibraryRoute } from './routes/LibraryRoute'
import { PlayerRoute } from './routes/PlayerRoute'
import { LibraryProvider } from './state/LibraryProvider'
import { PreferencesProvider } from './state/PreferencesProvider'
import { SessionProvider } from './state/SessionProvider'
import { ThemeProvider } from './state/ThemeProvider'

/**
 * Three destinations: write it, play it, keep it. Saved loops and sounds were
 * separate tabs answering the same question, and they now share one library.
 * The old paths still resolve, because they have been shared and bookmarked.
 *
 * Hash routing on purpose: GitHub Pages serves static files with no rewrite
 * rules, so `/Manifester/library` would 404 on refresh or on a shared link.
 * `#/library` always resolves to the one real document. See the README.
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
                  <Route path="/library" element={<LibraryRoute />} />
                  <Route path="/about" element={<AboutRoute />} />
                  <Route
                    path="/saved"
                    element={<Navigate to="/library" replace />}
                  />
                  <Route
                    path="/sounds"
                    element={<Navigate to="/library?show=sounds" replace />}
                  />
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
