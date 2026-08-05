import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useSettings } from '../features/profile/useSettings'
import {
  EQUIPMENT_LABELS,
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  MUSCLE_LABELS,
} from '../types'

/** Le modalità della sezione 9 della specifica. `fase` dice quando arriva il motore. */
const MODALITA = [
  { nome: 'Bodybuilding', desc: 'Push, Pull, Legs, Upper, Lower, Full Body', fase: 6 },
  { nome: 'Forza', desc: 'Squat, stacco, panca, sopra la testa', fase: 7 },
  { nome: 'CrossFit', desc: 'Standard oppure Hybrid', fase: 8 },
  { nome: 'Condizionamento', desc: 'AMRAP, EMOM, For Time, circuiti', fase: 10 },
  { nome: 'Tabata', desc: 'Intervalli a tempo', fase: 11 },
]

export default function Home() {
  const { user } = useAuth()
  const { profile, settings, loading } = useSettings(user?.id)

  const nome = profile?.display_name?.split(' ')[0]

  return (
    <div className="px-5 pt-12">
      <p className="eyebrow mb-3">{nome ? `Ciao ${nome}` : 'Bentornato'}</p>

      <h1 className="font-display font-extrabold uppercase leading-[0.88] tracking-tight text-[2.6rem]">
        Cosa alleni
        <br />
        oggi?
      </h1>

      {/* Riepilogo del profilo: dati veri, letti dal database */}
      {!loading && settings && (
        <Link
          to="/profile"
          className="slab mt-7 block"
          aria-label="Apri le tue impostazioni"
        >
          <p className="eyebrow mb-2.5">Le tue impostazioni</p>
          <p className="text-[15px] leading-snug">
            {EXPERIENCE_LABELS[settings.experience]} · {GOAL_LABELS[settings.primary_goal]}
            <br />
            <span className="text-slate2">
              {EQUIPMENT_LABELS[settings.equipment]}
            </span>
          </p>
          <div className="mt-3 flex items-baseline gap-4 font-data text-[13px]">
            <span>
              <span className="text-xl">{settings.default_duration}</span>
              <span className="text-slate2"> min</span>
            </span>
            <span>
              <span className="text-xl">{settings.training_frequency}</span>
              <span className="text-slate2"> volte a settimana</span>
            </span>
          </div>
          {settings.priority_muscles.length > 0 && (
            <p className="mt-3 text-[13px] text-slate2">
              Priorità:{' '}
              <span className="text-chalk">
                {settings.priority_muscles.map((m) => MUSCLE_LABELS[m]).join(' · ')}
              </span>
            </p>
          )}
        </Link>
      )}

      {loading && (
        <div className="slab mt-7 h-28 animate-pulse" aria-hidden />
      )}

      <p className="eyebrow mt-9 mb-3">Modalità</p>
      <ul className="space-y-2.5">
        {MODALITA.map((m) => (
          <li key={m.nome}>
            <div className="slab opacity-60">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display font-bold uppercase tracking-wide text-[17px]">
                  {m.nome}
                </h2>
                <span className="font-data text-[10px] uppercase tracking-[0.14em] text-amber2 whitespace-nowrap">
                  fase {m.fase}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-slate2">{m.desc}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[13px] leading-relaxed text-slate2">
        I motori di generazione non ci sono ancora. Questa prima versione serve a
        impostare il tuo profilo: quello che scegli qui deciderà come verranno
        costruiti gli allenamenti.
      </p>
    </div>
  )
}
