import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './features/auth/AuthProvider'
import { WorkoutProvider, useWorkout } from './features/workout/WorkoutContext'
import LoginPage from './features/auth/LoginPage'
import BottomNav from './components/BottomNav'
import Create from './pages/Create'
import WorkoutPreview from './pages/WorkoutPreview'
import Runner from './pages/Runner'
import Saved from './pages/Saved'
import History from './pages/History'
import ProfilePage from './pages/ProfilePage'
import ActiveTimerBanner from './components/ActiveTimerBanner'
import { hasActiveWorkoutSession } from './engine/activeWorkoutSession'

function Guscio() {
  const { user, loading } = useAuth()
  const { workout } = useWorkout()
  const { pathname } = useLocation()

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <span className="font-data text-[11px] uppercase tracking-[0.2em] text-slate2">Un attimo…</span>
      </div>
    )
  }

  // Una sessione già iniziata resta accessibile anche durante un rinnovo token
  // fallito o un periodo offline. Le altre pagine restano protette.
  if (!user && !(pathname === '/avvia' && workout)) return <LoginPage />

  if (workout && pathname !== '/avvia' && hasActiveWorkoutSession()) {
    return <Navigate to="/avvia" replace />
  }

  // Durante l'allenamento la navigazione sparisce: si resta sul pezzo.
  const conNav = pathname !== '/avvia'

  return (
    <div className={`mx-auto min-h-dvh max-w-lg ${conNav ? 'pb-24' : ''}`}>
      <ActiveTimerBanner />
      <Routes>
        <Route path="/" element={<Create />} />
        <Route path="/allenamento" element={<WorkoutPreview />} />
        <Route path="/avvia" element={<Runner />} />
        <Route path="/salvati" element={<Saved />} />
        <Route path="/storico" element={<History />} />
        <Route path="/profilo" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {conNav && <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <WorkoutProvider>
        <BrowserRouter>
          <Guscio />
        </BrowserRouter>
      </WorkoutProvider>
    </AuthProvider>
  )
}
