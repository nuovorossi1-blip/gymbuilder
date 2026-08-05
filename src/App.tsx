import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './features/auth/AuthProvider'
import LoginPage from './features/auth/LoginPage'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import ProfilePage from './pages/ProfilePage'
import Placeholder from './pages/Placeholder'

function Guscio() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <span className="font-data text-[11px] uppercase tracking-[0.2em] text-slate2">
          Un attimo…
        </span>
      </div>
    )
  }

  if (!user) return <LoginPage />

  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-24">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/build"
          element={
            <Placeholder
              titolo="Crea"
              fase="fasi 6-11"
              cosa="Qui sceglierai la modalità, regolerai la sessione di oggi e genererai l'allenamento. Serve prima il database degli esercizi (fase 4) e poi i motori di generazione."
            />
          }
        />
        <Route
          path="/saved"
          element={
            <Placeholder
              titolo="Salvati"
              fase="fase 14"
              cosa="Gli allenamenti che salvi e quelli che segni come preferiti, pronti da ripetere identici o da rigenerare in una variante."
            />
          }
        />
        <Route
          path="/history"
          element={
            <Placeholder
              titolo="Storico"
              fase="fase 15"
              cosa="Ogni allenamento completato, con durata, carichi, note e la tua valutazione."
            />
          }
        />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Guscio />
      </BrowserRouter>
    </AuthProvider>
  )
}
