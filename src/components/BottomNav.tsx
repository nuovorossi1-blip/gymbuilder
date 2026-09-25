import { NavLink, useLocation } from 'react-router-dom'

const SINISTRA = [
  { to: '/', label: 'Oggi', icon: '🏠' },
  { to: '/ultimo', label: 'Ultimo', icon: '⏱️' },
]
const DESTRA = [
  { to: '/salvati', label: 'Salvati', icon: '📁' },
  { to: '/profilo', label: 'Profilo', icon: '👤' },
]

function Voce({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <li className="flex-1">
      <NavLink
        to={to}
        end={to === '/'}
        className={({ isActive }) =>
          `relative flex flex-col items-center gap-1 py-2.5 transition-all ${isActive ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`
        }
      >
        {({ isActive }) => (
          <>
            {isActive && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-cyan-400 glow-cyan" />}
            <span className="text-lg">{icon}</span>
            <span className="font-data text-[10px] uppercase tracking-wider">{label}</span>
          </>
        )}
      </NavLink>
    </li>
  )
}

/** Barra in basso (25/09): "Coach" al centro, tra Ultimo e Salvati, apre subito la chat. */
export default function BottomNav() {
  const { pathname } = useLocation()
  const suCoach = pathname.startsWith('/coach')
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 border-t border-white/10 bg-slate-950/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      aria-label="Navigazione principale"
    >
      <ul className="mx-auto flex max-w-lg items-center justify-around">
        {SINISTRA.map((v) => <Voce key={v.to} {...v} />)}
        <li className="flex-1">
          <NavLink to="/coach?c=chat" className="flex flex-col items-center gap-1 py-1.5" aria-label="Parla con il Coach">
            <span className={`-mt-5 flex h-12 w-12 items-center justify-center rounded-full border-2 text-xl shadow-lg ${suCoach ? 'border-cyan-300 bg-cyan-500 text-ink glow-cyan' : 'border-cyan-500/60 bg-cyan-500/20 text-cyan-100'}`}>💬</span>
            <span className={`font-data text-[10px] uppercase tracking-wider ${suCoach ? 'text-cyan-400 font-bold' : 'text-slate-300'}`}>Coach</span>
          </NavLink>
        </li>
        {DESTRA.map((v) => <Voce key={v.to} {...v} />)}
      </ul>
    </nav>
  )
}
