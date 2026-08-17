import { NavLink } from 'react-router-dom'

const VOCI = [
  { to: '/', label: 'Oggi', icon: '🏠' },
  { to: '/ultimo', label: 'Ultimo', icon: '⏱️' },
  { to: '/salvati', label: 'Salvati', icon: '📁' },
  { to: '/profilo', label: 'Profilo', icon: '👤' },
]

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 border-t border-white/10 bg-slate-950/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      aria-label="Navigazione principale"
    >
      <ul className="mx-auto flex max-w-lg items-center justify-around">
        {VOCI.map((v) => (
          <li key={v.to} className="flex-1">
            <NavLink
              to={v.to}
              end={v.to === '/'}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-1 py-2.5 transition-all ${
                  isActive ? 'text-cyan-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute top-0 h-0.5 w-8 rounded-full bg-cyan-400 glow-cyan"
                    />
                  )}
                  <span className="text-lg">{v.icon}</span>
                  <span className="font-data text-[10px] uppercase tracking-wider">
                    {v.label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
