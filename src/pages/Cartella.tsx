/**
 * "La mia cartella" (Fase 2, 25/09): la cartella del cliente, modificabile a mano, esportabile
 * nel file unico .md e reimportabile (anche se aggiornata da un altro LLM).
 */
import { useEffect, useState, type ReactNode } from 'react'
import { BackButton } from '../components/BackButton'
import { useAuth } from '../features/auth/AuthProvider'
import { useSettings } from '../features/profile/useSettings'
import { useCartella } from '../features/cartella/useCartella'
import { abbinaEsercizio, normalizzaCartella } from '../features/cartella/cartella'
import { FileCartella } from '../features/cartella/FileCartella'
import { CARTELLA_VUOTA, type CartellaCliente, type EsercizioNota, type NotaMuscolo } from '../features/cartella/types'
import { useWorkout } from '../features/workout/WorkoutContext'
import { caricaCatalogo } from '../lib/api'
import { determinaFase } from '../engine/nutrition'
import { MUSCLE_LABELS, type Exercise, type Muscle } from '../types'

const MUSCOLI = Object.keys(MUSCLE_LABELS) as Muscle[]

function Sezione({ titolo, spiegazione, children }: { titolo: string; spiegazione?: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-base font-bold uppercase text-white">{titolo}</h2>
      {spiegazione && <p className="mt-1 text-xs leading-relaxed text-slate2">{spiegazione}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

const Rimuovi = ({ onClick }: { onClick: () => void }) => (
  <button type="button" aria-label="Rimuovi" onClick={onClick} className="shrink-0 rounded-lg border border-edge px-2.5 py-2 text-xs text-slate2">✕</button>
)
const Aggiungi = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick} className="w-full rounded-xl border border-dashed border-edge py-2.5 text-xs text-slate2">+ {children}</button>
)

function ListaMuscoli({ valori, onChange, etichetta }: { valori: NotaMuscolo[]; onChange: (v: NotaMuscolo[]) => void; etichetta: string }) {
  return (
    <>
      {valori.map((v, i) => (
        <div key={i} className="flex gap-2">
          <select className="input w-40 shrink-0" value={v.muscolo} onChange={(e) => onChange(valori.map((x, j) => (j === i ? { ...x, muscolo: e.target.value as Muscle } : x)))}>
            {MUSCOLI.map((m) => <option key={m} value={m}>{MUSCLE_LABELS[m]}</option>)}
          </select>
          <input className="input" placeholder="Note (es. trapezio compensa con carichi alti)" value={v.note} onChange={(e) => onChange(valori.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
          <Rimuovi onClick={() => onChange(valori.filter((_, j) => j !== i))} />
        </div>
      ))}
      <Aggiungi onClick={() => onChange([...valori, { muscolo: MUSCOLI.find((m) => !valori.some((v) => v.muscolo === m)) ?? 'chest', note: '' }])}>{etichetta}</Aggiungi>
    </>
  )
}

function ListaEsercizi({ valori, onChange, catalog, etichetta, notaPlaceholder, conSeduta }: {
  valori: (EsercizioNota & { seduta?: string; slot?: number })[]
  onChange: (v: (EsercizioNota & { seduta?: string; slot?: number })[]) => void
  catalog: Exercise[]; etichetta: string; notaPlaceholder: string; conSeduta?: boolean
}) {
  const set = (i: number, patch: Partial<EsercizioNota & { seduta?: string; slot?: number }>) => onChange(valori.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <>
      {valori.map((v, i) => (
        <div key={i} className="rounded-xl border border-edge p-3 space-y-2">
          <div className="flex gap-2">
            <input
              className="input" list="catalogo-esercizi" placeholder="Esercizio" value={v.nome}
              onChange={(e) => set(i, { nome: e.target.value, exercise_id: abbinaEsercizio(e.target.value, catalog) })}
            />
            <Rimuovi onClick={() => onChange(valori.filter((_, j) => j !== i))} />
          </div>
          <p className={`text-[11px] ${v.exercise_id ? 'text-emerald-300' : 'text-slate2'}`}>{v.exercise_id ? 'Riconosciuto nel catalogo' : 'Non nel catalogo: il coach lo leggerà come testo'}</p>
          {conSeduta && (
            <div className="flex gap-2">
              <input className="input" placeholder="Seduta (es. Pull A)" value={v.seduta ?? ''} onChange={(e) => set(i, { seduta: e.target.value })} />
              <input className="input w-24" inputMode="numeric" placeholder="Slot" value={v.slot ?? ''} onChange={(e) => set(i, { slot: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
          )}
          <input className="input" placeholder={notaPlaceholder} value={v.nota ?? ''} onChange={(e) => set(i, { nota: e.target.value })} />
        </div>
      ))}
      <Aggiungi onClick={() => onChange([...valori, { nome: '' }])}>{etichetta}</Aggiungi>
    </>
  )
}

export default function Cartella() {
  const { user } = useAuth()
  const { profile, calorieLog } = useSettings(user?.id)
  const { cartella: salvata, aggiornata, errore, salva } = useCartella(user?.id)
  const { catalog: ctxCatalog, setCatalog } = useWorkout()
  const [catalog, setLocalCatalog] = useState<Exercise[]>(ctxCatalog ?? [])
  const [c, setC] = useState<CartellaCliente>(CARTELLA_VUOTA)
  const [stato, setStato] = useState<'idle' | 'salvo' | 'salvata'>('idle')
  const fase = determinaFase(profile, calorieLog)

  useEffect(() => { if (salvata) setC(salvata) }, [salvata])
  useEffect(() => {
    if (catalog.length) return
    caricaCatalogo().then((items) => { setLocalCatalog(items); setCatalog(items) }).catch(() => undefined)
  }, [catalog.length, setCatalog])
  const patch = <K extends keyof CartellaCliente>(k: K, v: CartellaCliente[K]) => { setC((old) => ({ ...old, [k]: v })); setStato('idle') }

  async function salvaTutto() {
    setStato('salvo')
    const ok = await salva(normalizzaCartella(c, catalog))
    setStato(ok ? 'salvata' : 'idle')
  }

  if (!salvata) return <main className="px-5 pt-12"><p className="text-slate2">Carico la cartella…</p></main>

  return (
    <main className="px-5 pb-32 pt-10">
      <datalist id="catalogo-esercizi">{catalog.filter((e) => !e.roles.includes('warmup')).map((e) => <option key={e.id} value={e.name} />)}</datalist>
      <BackButton />
      <h1 className="mt-3 font-display text-[2.2rem] font-extrabold uppercase leading-none">La mia cartella</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate2">
        Quello che il Coach deve sapere di te. Peso, calorie, sonno, stress e fastidi si modificano nel Profilo;
        peso e girovita nel loro diario. {aggiornata && `Ultimo salvataggio: ${new Date(aggiornata).toLocaleDateString('it-IT')}.`}
      </p>

      <FileCartella catalog={catalog} cartella={c} onCartella={async (nuova: CartellaCliente) => { setC(nuova); await salva(nuova) }} />

      <Sezione titolo="Dal profilo" spiegazione="Letti dal Profilo: modificali lì.">
        <p className="rounded-xl border border-edge bg-steel/50 p-3 text-sm leading-relaxed text-chalk">
          {[profile?.age && `${profile.age} anni`, profile?.height_cm && `${profile.height_cm} cm`, profile?.weight_kg && `${profile.weight_kg} kg`].filter(Boolean).join(' · ') || 'Dati fisici non inseriti.'}
          <br />{fase?.summary ?? 'Fase nutrizionale non ancora nota.'}
        </p>
        <input className="input" placeholder="Livello ed esperienza (es. avanzato, 8 anni, ottima connessione mente-muscolo)" value={c.livello_note} onChange={(e) => patch('livello_note', e.target.value)} />
      </Sezione>

      <Sezione titolo="Quanto ti alleni" spiegazione="Da qui l'app costruisce lo scheletro della scheda (sedute, esercizi per muscolo, serie).">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="field-label">Giorni a settimana</span>
            <select className="input" value={c.giorni_settimana ?? ''} onChange={(e) => patch('giorni_settimana', e.target.value ? Number(e.target.value) : null)}>
              <option value="">Non indicato</option>
              {[3, 4, 5, 6].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Minuti per seduta</span>
            <input className="input" inputMode="numeric" value={c.durata_min ?? ''} onChange={(e) => patch('durata_min', e.target.value ? Number(e.target.value) : null)} />
          </label>
        </div>
      </Sezione>

      <Sezione titolo="Obiettivo">
        <input className="input" placeholder="Primario (es. V-shape: spalle larghe e vita stretta)" value={c.obiettivo.primario} onChange={(e) => patch('obiettivo', { ...c.obiettivo, primario: e.target.value })} />
        <input className="input" placeholder="Secondario (es. braccia più piene)" value={c.obiettivo.secondario} onChange={(e) => patch('obiettivo', { ...c.obiettivo, secondario: e.target.value })} />
        <input className="input" placeholder="Indiretto (es. girovita visivamente più stretto)" value={c.obiettivo.indiretto} onChange={(e) => patch('obiettivo', { ...c.obiettivo, indiretto: e.target.value })} />
      </Sezione>

      <Sezione titolo="Vincoli tassativi" spiegazione="Non si toccano mai senza la tua conferma. Gli esercizi vietati riconosciuti nel catalogo vengono esclusi anche dal generatore.">
        {c.vincoli.map((v, i) => (
          <div key={i} className="rounded-xl border border-edge p-3 space-y-2">
            <div className="flex gap-2">
              <input className="input" placeholder="Zona (es. Girovita, Spalla destra)" value={v.zona} onChange={(e) => patch('vincoli', c.vincoli.map((x, j) => (j === i ? { ...x, zona: e.target.value } : x)))} />
              <Rimuovi onClick={() => patch('vincoli', c.vincoli.filter((_, j) => j !== i))} />
            </div>
            <input className="input" placeholder="Problema" value={v.problema} onChange={(e) => patch('vincoli', c.vincoli.map((x, j) => (j === i ? { ...x, problema: e.target.value } : x)))} />
            <input className="input" list="catalogo-esercizi" placeholder="Esercizi vietati, separati da virgola" value={v.vietati.join(', ')} onChange={(e) => patch('vincoli', c.vincoli.map((x, j) => (j === i ? { ...x, vietati: e.target.value.split(',').map((t) => t.trim()).filter((t, k, a) => t || k === a.length - 1) } : x)))} />
            <input className="input" placeholder="Strategia (es. core solo anti-estensione)" value={v.strategia} onChange={(e) => patch('vincoli', c.vincoli.map((x, j) => (j === i ? { ...x, strategia: e.target.value } : x)))} />
          </div>
        ))}
        <Aggiungi onClick={() => patch('vincoli', [...c.vincoli, { zona: '', problema: '', vietati: [], strategia: '' }])}>Aggiungi vincolo</Aggiungi>
      </Sezione>

      <Sezione titolo="Carenze" spiegazione="Priorità massima: primi slot, 3-4 volte a settimana.">
        <ListaMuscoli valori={c.carenze} onChange={(v) => patch('carenze', v)} etichetta="Aggiungi carenza" />
      </Sezione>
      <Sezione titolo="Punti forti" spiegazione="Mantenimento: slot bassi, volume minimo efficace.">
        <ListaMuscoli valori={c.punti_forti} onChange={(v) => patch('punti_forti', v)} etichetta="Aggiungi punto forte" />
      </Sezione>

      <Sezione titolo="Esercizi che senti bene" spiegazione="Hanno la priorità nel programma (anche nel generatore).">
        <ListaEsercizi valori={c.esercizi_ok} onChange={(v) => patch('esercizi_ok', v)} catalog={catalog} etichetta="Aggiungi esercizio" notaPlaceholder="Perché (es. capo lungo in allungamento)" />
      </Sezione>
      <Sezione titolo="Esercizi dove perdi tensione">
        <ListaEsercizi valori={c.esercizi_perdita_tensione} onChange={(v) => patch('esercizi_perdita_tensione', v)} catalog={catalog} etichetta="Aggiungi esercizio" notaPlaceholder="Soluzione (es. carichi bassi, 15-20 rip, pausa in alto)" />
      </Sezione>
      <Sezione titolo="Esercizi obbligatori" spiegazione="Il coach li inserisce come principali; può spostarli di posizione.">
        <ListaEsercizi valori={c.obbligatori} onChange={(v) => patch('obbligatori', v)} catalog={catalog} etichetta="Aggiungi obbligatorio" notaPlaceholder="Nota" conSeduta />
      </Sezione>

      <Sezione titolo="Attrezzatura della tua palestra">
        <textarea className="input min-h-24" placeholder={'Una voce per riga (es. Cavi alto e basso, Pendulum squat, T-bar petto supportato)'} value={c.attrezzatura.join('\n')} onChange={(e) => patch('attrezzatura', e.target.value.split('\n'))} />
      </Sezione>

      <Sezione titolo="Riscaldamento fisso" spiegazione="Non conta tra gli esercizi della seduta.">
        <div className="flex gap-2">
          <input className="input" value={c.riscaldamento.descrizione} onChange={(e) => patch('riscaldamento', { ...c.riscaldamento, descrizione: e.target.value })} />
          <input className="input w-20" inputMode="numeric" value={c.riscaldamento.minuti} onChange={(e) => patch('riscaldamento', { ...c.riscaldamento, minuti: Number(e.target.value) || 0 })} aria-label="Minuti" />
        </div>
      </Sezione>

      <Sezione titolo="Macronutrienti" spiegazione={`Obiettivi giornalieri in grammi. Proteine consigliate 1,6-2,2 g per kg${profile?.weight_kg ? `: ${Math.round(Number(profile.weight_kg) * 1.6)}-${Math.round(Number(profile.weight_kg) * 2.2)} g` : ''}.`}>
        <div className="grid grid-cols-3 gap-2">
          {(['proteine_g', 'grassi_g', 'carboidrati_g'] as const).map((k) => (
            <label key={k} className="block">
              <span className="field-label">{k === 'proteine_g' ? 'Proteine' : k === 'grassi_g' ? 'Grassi' : 'Carboidrati'}</span>
              <input className="input" inputMode="numeric" value={c.macro[k] ?? ''} onChange={(e) => patch('macro', { ...c.macro, [k]: e.target.value ? Number(e.target.value) : null })} />
            </label>
          ))}
        </div>
      </Sezione>

      <Sezione titolo="Storico controlli" spiegazione="Lo compila il Coach a ogni controllo.">
        {c.controlli.length === 0 ? <p className="text-sm text-slate2">Nessun controllo ancora.</p> : c.controlli.slice().reverse().map((k) => (
          <div key={k.data} className="rounded-xl border border-edge p-3 text-sm">
            <p className="font-data text-[12px] text-slate2">{k.data}</p>
            <p className="text-chalk">{[k.peso && `${k.peso} kg`, k.girovita && `${k.girovita} cm`, k.energia && `energia ${k.energia}`].filter(Boolean).join(' · ')}</p>
            {k.decisioni && <p className="mt-1 text-slate2">{k.decisioni}</p>}
          </div>
        ))}
      </Sezione>

      {errore && <p role="alert" className="mt-6 text-sm text-amber2">{errore}</p>}
      <div className="fixed inset-x-0 bottom-20 z-10 mx-auto max-w-lg px-5">
        <button className="btn shadow-lg" disabled={stato === 'salvo'} onClick={() => { void salvaTutto() }}>
          {stato === 'salvo' ? 'Salvataggio…' : stato === 'salvata' ? 'Salvata ✓' : 'Salva la cartella'}
        </button>
      </div>
    </main>
  )
}
