/**
 * Scarica / carica il "file unico" .md (25/09): cartella + programma del Coach. Usato nella
 * pagina della cartella e nel Coach. Funziona con qualunque LLM scelto: se il file non è stato
 * toccato si ricarica esatto dal blocco nascosto; se è stato modificato lo legge l'LLM attivo.
 */
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useSettings } from '../profile/useSettings'
import { loadLocalAiSettings } from '../profile/aiSettings'
import { useCoach } from '../coach/useCoach'
import { normalizzaPiano, type CoachPlan } from '../coach/plan'
import { leggiCartellaConLlm } from '../../lib/deepseek'
import { elencoProgrammi } from '../../lib/api'
import { cartellaInMarkdown, leggiMarkdown, normalizzaCartella } from './cartella'
import type { CartellaCliente } from './types'
import type { Exercise, WeeklyProgram } from '../../types'

interface Props {
  catalog: Exercise[]
  cartella: CartellaCliente
  /** Applica la cartella letta dal file (la pagina decide se salvare subito o far controllare). */
  onCartella: (c: CartellaCliente) => void | Promise<void>
  /** Piano proposto non ancora accettato (es. nel Coach): se c'è, finisce nel file al posto di quello attivo. */
  pianoProposto?: CoachPlan | null
  compatto?: boolean
}

export function FileCartella({ catalog, cartella, onCartella, pianoProposto, compatto }: Props) {
  const { user } = useAuth()
  const { profile, calorieLog, bodyLog } = useSettings(user?.id)
  const { piano, accettaPiano } = useCoach(user?.id)
  const [programma, setProgramma] = useState<WeeklyProgram | null>(null)
  const [stato, setStato] = useState<{ fase: 'idle' | 'leggo' | 'anteprima' | 'errore' | 'fatto'; msg?: string; c?: CartellaCliente; p?: CoachPlan | null; fonte?: string }>({ fase: 'idle' })

  useEffect(() => {
    if (!user) return
    elencoProgrammi(user.id).then((lista) => setProgramma(lista[0]?.program ?? null)).catch(() => undefined)
  }, [user])

  function scarica() {
    const coachPlan = pianoProposto ?? piano?.plan ?? null
    const md = cartellaInMarkdown({ cartella: normalizzaCartella(cartella, catalog), profile, calorieLog, bodyLog, program: coachPlan ? null : programma, coachPlan })
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `coaching_${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function carica(file: File) {
    setStato({ fase: 'leggo' })
    try {
      const md = await file.text()
      const letto = leggiMarkdown(md, catalog)
      if (letto.cartella && !letto.testoModificato) {
        setStato({ fase: 'anteprima', c: letto.cartella, p: letto.piano ? normalizzaPiano(letto.piano, catalog) : null, fonte: 'File di GymBuilder non modificato: dati esatti.' })
        return
      }
      const raw = await leggiCartellaConLlm(loadLocalAiSettings(), md, letto.cartella ?? cartella) as Record<string, unknown>
      setStato({
        fase: 'anteprima',
        c: normalizzaCartella(raw, catalog),
        p: raw.piano ? normalizzaPiano(raw.piano, catalog) : letto.piano ? normalizzaPiano(letto.piano, catalog) : null,
        fonte: letto.cartella ? 'Il testo è stato modificato dopo l’esportazione: l’ha letto il tuo LLM.' : 'File senza dati di GymBuilder: l’ha letto il tuo LLM.',
      })
    } catch (e) {
      setStato({ fase: 'errore', msg: e instanceof Error ? e.message : 'File non leggibile.' })
    }
  }

  async function applica() {
    if (!stato.c) return
    await onCartella(stato.c)
    if (stato.p) await accettaPiano(stato.p, 'chat', 'Programma caricato da file .md')
    setStato({ fase: 'fatto', msg: stato.p ? 'Cartella e programma caricati.' : 'Cartella caricata.' })
  }

  return (
    <div className={compatto ? '' : 'mt-5'}>
      <div className="grid grid-cols-2 gap-2">
        <button className="rounded-xl border border-edge py-3 text-sm" onClick={scarica}>⬇ Scarica .md</button>
        <label className="cursor-pointer rounded-xl border border-edge py-3 text-center text-sm">
          ⬆ Carica .md
          <input type="file" accept=".md,.txt,text/markdown,text/plain" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void carica(f); e.target.value = '' }} />
        </label>
      </div>
      {stato.fase === 'leggo' && <p className="mt-3 text-sm text-slate2" role="status">Leggo il file…</p>}
      {(stato.fase === 'errore' || stato.fase === 'fatto') && <p className={`mt-3 text-sm ${stato.fase === 'errore' ? 'text-amber2' : 'text-emerald-300'}`} role="status">{stato.msg}</p>}
      {stato.fase === 'anteprima' && stato.c && (
        <div className="mt-4 rounded-2xl border border-cyan-500/40 bg-cyan-500/5 p-4" role="status">
          <p className="text-sm text-chalk">{stato.fonte}</p>
          <p className="mt-2 font-data text-[12px] text-slate2">
            {stato.c.carenze.length} carenze · {stato.c.vincoli.length} vincoli · {stato.c.esercizi_ok.length} esercizi ok · {stato.c.controlli.length} controlli
            {stato.p ? ` · programma "${stato.p.titolo}" con ${stato.p.sedute.length} sedute` : ' · nessun programma nel file'}
          </p>
          <div className="mt-3 flex gap-2">
            <button className="btn flex-1" onClick={() => { void applica() }}>Usa questi dati</button>
            <button className="flex-1 rounded-xl border border-edge py-3 text-sm" onClick={() => setStato({ fase: 'idle' })}>Annulla</button>
          </div>
          {stato.p && <p className="mt-2 text-[11px] text-slate2">Il programma diventa quello attivo (nuova versione); il precedente resta nelle versioni.</p>}
        </div>
      )}
    </div>
  )
}
