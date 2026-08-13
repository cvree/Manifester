import { Navigate, Route, HashRouter as Router, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import { AboutRoute } from './routes/AboutRoute'
import { CreateRoute } from './routes/CreateRoute'
import { LaunchRoute } from './routes/LaunchRoute'
import { LibraryRoute } from './routes/LibraryRoute'
import { PlayerRoute } from './routes/PlayerRoute'
import { SharedLoopRoute } from './routes/SharedLoopRoute'
import { LibraryProvider } from './state/LibraryProvider'
import { PreferencesProvider } from './state/PreferencesProvider'
import { SessionProvider } from './state/SessionProvider'
import { StageProvider } from './state/StageProvider'
import { ThemeProvider } from './state/ThemeProvider'

export default function App() {
  return (
    <ThemeProvider>
      <PreferencesProvider>
        <LibraryProvider>
          <SessionProvider>
            <StageProvider>
              <Router>
                <Routes>
                  <Route element={<AppShell />}>
                    <Route index element={<LaunchRoute />} />
                    <Route path="/create" element={<CreateRoute />} />
                    <Route path="/player" element={<PlayerRoute />} />
                    <Route path="/library" element={<LibraryRoute />} />
                    <Route path="/share" element={<SharedLoopRoute />} />
                    <Route path="/about" element={<AboutRoute />} />
                    <Route path="/saved" element={<Navigate to="/library" replace />} />
                    <Route
                      path="/sounds"
                      element={<Navigate to="/library?show=sounds" replace />}
                    />
                    <Route path="*" element={<LaunchRoute />} />
                  </Route>
                </Routes>
              </Router>
            </StageProvider>
          </SessionProvider>
        </LibraryProvider>
      </PreferencesProvider>
    </ThemeProvider>
  )
}
