/**
 * Punto d'ingresso reale per il protocollo Density Tri-Set 3-6-9 (Fase 3, 21/08): scelta
 * dello split e guida rapida (sez. 5 della spec originale, le 4 regole operative) prima di
 * avviare `/density-369`. Prima di questa pagina l'unico modo di raggiungerlo era scrivere
 * l'indirizzo a mano — vedi TODO.md.
 */

import { useNavigate } from 'react-router-dom'
import type { DensitySplit } from '../generators/density369'

const SPLIT_INFO: { value: DensitySplit; label: string; sottotitolo: string }[] = [
  { value: 'push', label: 'Push', sottotitolo: 'Petto → Spalle/Tricipiti' },
  { value: 'pull', label: 'Pull', sottotitolo: 'Dorso → Bicipiti' },
  { value: 'legs', label: 'Legs', sottotitolo: 'Quadricipiti → Catena posteriore' },
]

const REGOLE = [
  {
    titolo: 'Autoregolazione dei Carichi',
    testo: 'Non usare pesi standard nelle stazioni 2 e 3: riduci il carico del 20-25% nella Stazione 2 e usa carichi leggeri (~50%) nella Stazione 3.',
  },
  {
    titolo: 'Regola del Buffer (RIR)',
    testo: 'Nella Stazione 1 tieni sempre 1-2 ripetizioni di margine — mai a cedimento concentrico, comprometterebbe il volume del circuito.',
  },
  {
    titolo: 'Doppia Progressione',
    testo: 'Aumenta il peso nella Stazione 1 solo quando chiudi 6 ripetizioni pulite in tutti i round previsti.',
  },
  {
    titolo: 'Logistica Salva-Postazione',
    testo: 'Tieni Blocco A e Blocco B nello stesso metro quadro (es. panca con manubri vicini) per rispettare i 10-15s di cambio stazione.',
  },
]

export default function Density369Scegli() {
  const naviga = useNavigate()

  return (
    <div className="px-5 pt-12 pb-8">
      <p className="eyebrow mb-2">Bodybuilding · Nuovo</p>
      <h1 className="font-display text-2xl font-bold text-white mb-2">Density Tri-Set 3-6-9</h1>
      <p className="text-sm text-slate-300 mb-6">
        Due blocchi, ognuno un circuito continuo di 3 stazioni a intensità decrescente: forza
        pesante (3-6 rep) → ipertrofia (6-12 rep) → stress metabolico (9-25 rep).
      </p>

      <p className="eyebrow mb-3 text-slate-400">Scegli lo split</p>
      <div className="space-y-2 mb-8">
        {SPLIT_INFO.map((s) => (
          <button
            key={s.value}
            onClick={() => naviga(`/density-369?split=${s.value}`)}
            className="w-full flex items-center justify-between rounded-xl glass-card border border-edge p-4 text-left hover:border-purple-500/50 transition-colors"
          >
            <div>
              <div className="font-display font-bold text-white">{s.label}</div>
              <div className="text-xs text-slate-400">{s.sottotitolo}</div>
            </div>
            <span className="text-purple-300">▶</span>
          </button>
        ))}
      </div>

      <p className="eyebrow mb-3 text-slate-400">Prima di iniziare</p>
      <div className="space-y-3">
        {REGOLE.map((r) => (
          <div key={r.titolo} className="rounded-xl glass-card border border-edge p-3.5">
            <div className="text-xs font-bold uppercase tracking-wide text-purple-300 mb-1">{r.titolo}</div>
            <p className="text-xs text-slate-300">{r.testo}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
