import { NavLink } from 'react-router-dom'

const VOCI = [
  { to: '/', label: 'Home' },
  { to: '/build', label: 'Crea' },
  { to: '/saved', label: 'Salvati' },
  { to: '/history', label: 'Storico' },
  { to: '/profile', label: 'Profilo' },
]

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20 border-t border-edge bg-ink/95 backdrop-blur
                 pb-[env(safe-area-inset-bottom)]"
      aria-label="Navigazione principale"
    >
      <ul className="mx-auto flex max-w-lg">
        {VOCI.map((v) => (
          <li key={v.to} className="flex-1">
            <NavLink
              to={v.to}
              end={v.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1.5 py-3 font-data text-[10px] uppercase tracking-[0.14em] transition-colors ${
                  isActive ? 'text-chalk' : 'text-slate2'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden
                    className={`h-[3px] w-6 rounded-full transition-colors ${
                      isActive ? 'bg-amber2' : 'bg-transparent'
                    }`}
                  />
                  {v.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
