import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './features/auth/AuthProvider'
import { WorkoutProvider, useWorkout } from './features/workout/WorkoutContext'
import LoginPage from './features/auth/LoginPage'
import BottomNav from './components/BottomNav'
import HomeDashboard from './pages/HomeDashboard'
import Create from './pages/Create'
import WorkoutPreview from './pages/WorkoutPreview'
import DensityRunner from './pages/DensityRunner'
import Runner from './pages/Runner'
import Saved from './pages/Saved'
import History from './pages/History'
import ProfilePage from './pages/ProfilePage'
import { ActiveTimerBanner } from './components/ActiveTimerBanner'
import NativeUpdater from './components/NativeUpdater'
import InstallBanner from './components/InstallBanner'
import { ErrorBoundary } from './components/ErrorBoundary'

function Guscio() {
  const { user, loading } = useAuth()
  const { workout, activeSession, resumeActiveSession } = useWorkout()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent<{ type?: string; href?: string }>) => {
      if (event.data?.type !== 'RESUME_ACTIVE_SESSION') return
      resumeActiveSession()
      navigate(event.data.href || '/avvia')
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate, resumeActiveSession])

  // Riaprendo la PWA (anche dalla sua icona) si torna sempre alla sessione
  // realmente attiva, invece di creare una seconda pagina/istanza di workout.
  useEffect(() => {
    if (!activeSession || pathname === '/avvia') return
    resumeActiveSession()
    navigate('/avvia', { replace: true })
  }, [activeSession, navigate, pathname, resumeActiveSession])

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <span className="font-data text-[11px] uppercase tracking-[0.2em] text-slate2">Un attimo…</span>
      </div>
    )
  }

  // Una sessione già iniziata resta accessibile anche durante un rinnovo token
  // fallito o un periodo offline. Le altre pagine restano protette.
  if (!user && !(pathname === '/avvia' && (workout || activeSession))) {
    return (
      <div className="mx-auto min-h-dvh max-w-lg">
        <InstallBanner />
        <LoginPage />
      </div>
    )
  }

  // Durante l'allenamento la navigazione sparisce: si resta sul pezzo.
  const conNav = pathname !== '/avvia'

  return (
    <div className={`mx-auto min-h-dvh max-w-lg ${conNav ? 'pb-24' : ''}`}>
      <ActiveTimerBanner />
      <InstallBanner />
      <Routes>
        <Route path="/" element={<HomeDashboard />} />
        <Route path="/crea" element={<Create />} />
        <Route path="/allenamento" element={<WorkoutPreview />} />
        <Route path="/density-369" element={<DensityRunner />} />
        <Route path="/avvia" element={<Runner />} />
        <Route path="/salvati" element={<Saved />} />
        <Route path="/ultimo" element={<History />} />
        <Route path="/storico" element={<Navigate to="/ultimo" replace />} />
        <Route path="/profilo" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {conNav && <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <NativeUpdater />
      <AuthProvider>
        <WorkoutProvider>
          <BrowserRouter>
            <Guscio />
          </BrowserRouter>
        </WorkoutProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
