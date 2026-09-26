/**
 * Piano del Coach (Fase 3, 25/09): struttura, normalizzazione della risposta dell'LLM e controlli
 * del codice. Regola concordata con Rossi: "l'LLM scrive, il codice controlla" — esercizi del
 * catalogo, vincoli tassativi, fastidi, alternanza dei muscoli per fase, multiarticolare in fondo,
 * durata e volume settimanale calcolato qui, non dall'LLM.
 */
import { minutiBlocco } from '../../generators/shared'
import { escludiPerFastidi } from '../../engine/nutrition'
import { violazioniInterleave } from '../../engine/programming'
import { contaSerie, rangeVolume } from '../../engine/weeklyVolume'
import { MUSCLE_LABELS, type Exercise, type GeneratedWorkout, type JointIssue, type Muscle, type NutritionPhase, type PrescribedExercise, type Split } from '../../types'
import { abbinaEsercizio, vietatiDallaCartella } from '../cartella/cartella'
import type { CartellaCliente } from '../cartella/types'

export interface CoachEsercizio {
  exercise_id: string
  nome: string
  serie: number
  reps: string
  rir: string
  recupero_sec: number
  nota?: string
  /** Esercizio equivalente se manca l'attrezzo o l'esercizio non va (testo del coach). */
  alternativa?: string
  tecnica?: string
}

export interface CoachSeduta {
  nome: string
  split: Split | null
  /** Sequenza dei muscoli e perché gli slot sono in quest'ordine (scritta dal coach). */
  logica?: string
  esercizi: CoachEsercizio[]
}

export interface CoachPlan {
  titolo: string
  giorni_settimana: number
  durata_min: number
  sedute: CoachSeduta[]
  calorie: number | null
  macro: { proteine_g: number | null; grassi_g: number | null; carboidrati_g: number | null }
  note: string
}

const SPLITS: Split[] = ['push', 'pull', 'legs', 'upper', 'lower', 'full_body', 'bro_chest', 'bro_back', 'bro_shoulders', 'bro_arms', 'bro_legs', 'front_body', 'back_body']
const n = (v: unknown, def: number | null = null) => {
  const x = typeof v === 'string' ? Number(v.replace(',', '.')) : v
  return typeof x === 'number' && Number.isFinite(x) ? x : def
}
const s = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '')

/** Ripulisce il piano scritto dall'LLM; gli esercizi senza id valido restano con id vuoto e
 *  vengono segnalati dai controlli (non si inventano abbinamenti). */
export function normalizzaPiano(raw: unknown, catalog: Exercise[]): CoachPlan | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  const byId = new Set(catalog.map((e) => e.id))
  const sedute = (Array.isArray(p.sedute) ? p.sedute : []).filter((x) => x && typeof x === 'object').map((x) => {
    const sd = x as Record<string, unknown>
    const esercizi = (Array.isArray(sd.esercizi) ? sd.esercizi : []).filter((e) => e && typeof e === 'object').map((e) => {
      const r = e as Record<string, unknown>
      const idGrezzo = s(r.exercise_id, 80)
      const nome = s(r.nome, 120) || s(r.name, 120)
      const id = byId.has(idGrezzo) ? idGrezzo : abbinaEsercizio(nome || idGrezzo, catalog) ?? ''
      return {
        exercise_id: id,
        nome: catalog.find((c) => c.id === id)?.name ?? (nome || idGrezzo),
        serie: Math.max(1, Math.min(10, Math.round(n(r.serie, 3)!))),
        reps: s(r.reps, 20) || '8-12',
        rir: s(r.rir, 10),
        recupero_sec: Math.max(0, Math.min(300, Math.round(n(r.recupero_sec, 90)!))),
        nota: s(r.nota) || undefined,
        alternativa: s(r.alternativa, 120) || undefined,
        tecnica: s(r.tecnica, 120) || undefined,
      }
    })
    const split = s(sd.split, 20) as Split
    return { nome: s(sd.nome, 40) || 'Seduta', split: SPLITS.includes(split) ? split : null, logica: s(sd.logica, 1200) || undefined, esercizi }
  }).filter((sd) => sd.esercizi.length > 0)
  if (sedute.length === 0) return null
  const macro = (p.macro && typeof p.macro === 'object' ? p.macro : {}) as Record<string, unknown>
  return {
    titolo: s(p.titolo, 80) || 'Piano del Coach',
    giorni_settimana: Math.max(1, Math.min(7, Math.round(n(p.giorni_settimana, sedute.length)!))),
    durata_min: Math.max(20, Math.min(180, Math.round(n(p.durata_min, 75)!))),
    sedute,
    calorie: n(p.calorie),
    macro: { proteine_g: n(macro.proteine_g), grassi_g: n(macro.grassi_g), carboidrati_g: n(macro.carboidrati_g) },
    note: s(p.note, 3000),
  }
}

/** Una seduta del piano nel formato comune dell'app (anteprima, esecuzione, storico). Il
 *  riscaldamento è quello fisso della cartella. */
export function sedutaComeWorkout(sd: CoachSeduta, catalog: Exercise[], cartella: CartellaCliente | null, carenze: Muscle[]): GeneratedWorkout {
  const byId = new Map(catalog.map((e) => [e.id, e]))
  const main: PrescribedExercise[] = sd.esercizi.map((e) => {
    const ex = byId.get(e.exercise_id)
    const muscle = ex?.primary_muscles.find((m) => carenze.includes(m)) ?? ex?.primary_muscles[0] ?? null
    return {
      exercise_id: e.exercise_id,
      name: ex?.name ?? e.nome,
      role: ex?.roles.includes('compound') ? 'compound' : 'isolation',
      muscle,
      sets: e.serie,
      reps: e.reps,
      rest_sec: e.recupero_sec,
      rir: e.rir || undefined,
      technique: e.tecnica,
      note: e.nota?.toLowerCase().includes('antagonist') ? 'antagonista' : muscle && carenze.includes(muscle) ? 'carenza' : undefined,
      // Esercizio da migliorare (26/09): nell'allenamento si segnano le ripetizioni pulite.
      prestazione: cartella?.esercizi_da_migliorare.some((x) => x.exercise_id === e.exercise_id) || undefined,
      instructions: ex?.instructions || undefined,
    }
  })
  const risc = cartella?.riscaldamento ?? { descrizione: 'Riscaldamento generale', minuti: 8 }
  const minuti = Math.round(risc.minuti + minutiBlocco(main))
  return {
    name: sd.nome,
    mode: 'bodybuilding',
    split: sd.split,
    goal: 'hypertrophy',
    experience: 'advanced',
    duration_min: minuti,
    blocks: [
      {
        kind: 'warmup', title: 'Riscaldamento fisso', duration_min: risc.minuti,
        exercises: [{ exercise_id: 'riscaldamento_fisso', name: risc.descrizione, role: 'warmup', muscle: null, sets: 1, reps: `${risc.minuti} min`, rest_sec: 0 }],
      },
      { kind: 'main', title: 'Allenamento', exercises: main },
    ],
    warnings: [],
    origine: 'coach',
  }
}

export interface EsitoControlli {
  /** Bloccano l'accettazione: il coach deve correggere. */
  errori: string[]
  /** Si può accettare lo stesso, ma vanno lette. */
  avvisi: string[]
  volume: { muscolo: Muscle; serie: number; frequenza: number; carenza: boolean; target: [number, number] }[]
}

export interface ContestoControlli {
  catalog: Exercise[]
  cartella: CartellaCliente | null
  fastidi: JointIssue[]
  phase: NutritionPhase | null
  /** Gradino calorico del volume (-500..+1000) per i range carenza/punto forte. */
  step?: number | null
}

export function controllaPiano(plan: CoachPlan, ctx: ContestoControlli): EsitoControlli {
  const errori: string[] = []
  const avvisi: string[] = []
  const byId = new Map(ctx.catalog.map((e) => [e.id, e]))
  const vietati = new Set(vietatiDallaCartella(ctx.cartella, ctx.catalog))
  const ammessiFastidi = new Set(escludiPerFastidi(ctx.catalog, ctx.fastidi).map((e) => e.id))
  const carenze = ctx.cartella?.carenze.map((c) => c.muscolo) ?? []
  const volume = new Map<Muscle, { serie: number; sedute: Set<number> }>()

  plan.sedute.forEach((sd, i) => {
    const sconosciuti = sd.esercizi.filter((e) => !byId.has(e.exercise_id)).map((e) => e.nome)
    if (sconosciuti.length) errori.push(`${sd.nome}: esercizi non presenti nel catalogo dell'app: ${sconosciuti.join(', ')}.`)
    const proibiti = sd.esercizi.filter((e) => vietati.has(e.exercise_id)).map((e) => e.nome)
    if (proibiti.length) errori.push(`${sd.nome}: esercizi vietati dai tuoi vincoli tassativi: ${proibiti.join(', ')}.`)
    const articolari = sd.esercizi.filter((e) => byId.has(e.exercise_id) && !ammessiFastidi.has(e.exercise_id)).map((e) => e.nome)
    if (articolari.length) errori.push(`${sd.nome}: esercizi sconsigliati per i tuoi fastidi articolari: ${articolari.join(', ')}.`)
    const senzaPerche = sd.esercizi.filter((e) => !e.nota).length
    if (senzaPerche > 0) avvisi.push(`${sd.nome}: ${senzaPerche} esercizi senza spiegazione del perché (chiedila pure al coach).`)
    const doppi = sd.esercizi.map((e) => e.exercise_id).filter((id, k, a) => id && a.indexOf(id) !== k)
    if (doppi.length) errori.push(`${sd.nome}: lo stesso esercizio compare due volte.`)

    const w = sedutaComeWorkout(sd, ctx.catalog, ctx.cartella, carenze)
    const main = w.blocks.find((b) => b.kind === 'main')!.exercises
    for (const v of violazioniInterleave(main, carenze, ctx.phase)) avvisi.push(`${sd.nome}: ${v}`)
    const ultimo = main[main.length - 1]
    if (main.length >= 5 && ultimo?.role === 'compound' && !['cable', 'machine'].includes(String(byId.get(ultimo.exercise_id)?.equipment))) {
      avvisi.push(`${sd.nome}: ${ultimo.name} è un multiarticolare a pesi liberi all'ultimo slot.`)
    }
    if (w.duration_min > plan.durata_min * 1.15) avvisi.push(`${sd.nome}: durata stimata ${w.duration_min} min, oltre i ${plan.durata_min} scelti.`)
    for (const [m, serie] of Object.entries(contaSerie(w)) as [Muscle, number][]) {
      const v = volume.get(m) ?? { serie: 0, sedute: new Set<number>() }
      v.serie += serie; v.sedute.add(i)
      volume.set(m, v)
    }
  })
  const fattore = plan.giorni_settimana / plan.sedute.length
  const step = ctx.step ?? (ctx.phase === 'deficit' ? -500 : ctx.phase === 'surplus' ? 500 : 0)
  const righe = [...volume.entries()].map(([muscolo, v]) => {
    const carenza = carenze.includes(muscolo)
    return {
      muscolo, carenza, target: rangeVolume(muscolo, carenza, step),
      serie: Math.round(v.serie * fattore), frequenza: Math.round(v.sedute.size * fattore * 10) / 10,
    }
  }).sort((a, b) => Number(b.carenza) - Number(a.carenza) || b.serie - a.serie)
  for (const c of carenze) if (!volume.has(c)) avvisi.push(`La carenza ${MUSCLE_LABELS[c]} non compare in nessuna seduta.`)
  // Range indicativi (tabella di Rossi): si segnalano solo gli scostamenti netti.
  for (const r of righe) {
    if (r.carenza && r.serie < r.target[0] - 2) avvisi.push(`${MUSCLE_LABELS[r.muscolo]} (carenza): ${r.serie} serie a settimana, sotto il range ${r.target[0]}-${r.target[1]}.`)
    if (!r.carenza && r.serie > r.target[1] + 3) avvisi.push(`${MUSCLE_LABELS[r.muscolo]} (non carente): ${r.serie} serie a settimana, sopra il range ${r.target[0]}-${r.target[1]}: toglie recupero alle carenze.`)
  }
  return { errori, avvisi, volume: righe }
}

/** Cosa cambia fra due versioni del piano, in italiano semplice (Fase 4). */
export function differenzePiani(prima: CoachPlan, dopo: CoachPlan): string[] {
  const out: string[] = []
  if (prima.calorie !== dopo.calorie && dopo.calorie) out.push(`Calorie: ${prima.calorie ?? '—'} → ${dopo.calorie} kcal.`)
  if (prima.giorni_settimana !== dopo.giorni_settimana) out.push(`Giorni a settimana: ${prima.giorni_settimana} → ${dopo.giorni_settimana}.`)
  const nomiPrima = prima.sedute.map((sd) => sd.nome)
  const nomiDopo = dopo.sedute.map((sd) => sd.nome)
  for (const n of nomiDopo) if (!nomiPrima.includes(n)) out.push(`Nuova seduta: ${n}.`)
  for (const n of nomiPrima) if (!nomiDopo.includes(n)) out.push(`Seduta tolta: ${n}.`)
  for (const sd of dopo.sedute) {
    const vecchia = prima.sedute.find((x) => x.nome === sd.nome)
    if (!vecchia) continue
    const idVecchi = vecchia.esercizi.map((e) => e.exercise_id)
    const idNuovi = sd.esercizi.map((e) => e.exercise_id)
    const cambi: string[] = []
    const tolti = vecchia.esercizi.filter((e) => !idNuovi.includes(e.exercise_id)).map((e) => e.nome || e.exercise_id).filter(Boolean)
    const aggiunti = sd.esercizi.filter((e) => !idVecchi.includes(e.exercise_id)).map((e) => e.nome || e.exercise_id).filter(Boolean)
    if (tolti.length) cambi.push(`tolto ${tolti.join(', ')}`)
    if (aggiunti.length) cambi.push(`aggiunto ${aggiunti.join(', ')}`)
    for (const e of sd.esercizi) {
      const v = vecchia.esercizi.find((x) => x.exercise_id === e.exercise_id)
      if (!v) continue
      const d: string[] = []
      if (v.serie !== e.serie) d.push(`serie ${v.serie}→${e.serie}`)
      if (v.reps !== e.reps) d.push(`rip ${v.reps}→${e.reps}`)
      if (v.rir !== e.rir) d.push(`RIR ${v.rir || '—'}→${e.rir || '—'}`)
      if ((v.tecnica ?? '') !== (e.tecnica ?? '')) d.push(e.tecnica ? `tecnica: ${e.tecnica}` : 'tecnica tolta')
      if (d.length) cambi.push(`${e.nome} (${d.join(', ')})`)
    }
    const comuniPrima = idVecchi.filter((id) => idNuovi.includes(id))
    const comuniDopo = idNuovi.filter((id) => idVecchi.includes(id))
    if (comuniPrima.join() !== comuniDopo.join()) cambi.push('ordine cambiato')
    if (cambi.length) out.push(`${sd.nome}: ${cambi.join('; ')}.`)
  }
  return out.length ? out : ['Nessuna modifica alle sedute.']
}
