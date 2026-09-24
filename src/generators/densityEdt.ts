/**
 * Density 3-6-9 (25/09, sostituisce il tri-set a 3 stazioni del 21/08 su decisione di Rossi).
 *
 * È l'unione di due metodi reali:
 *  - EDT (Escalating Density Training, Charles Staley): la seduta è fatta di 2-3 "zone PR" a tempo
 *    (15 minuti, 5 minuti di pausa fra una e l'altra). In ogni zona si alternano DUE esercizi
 *    antagonisti o che non si disturbano, a mini-serie, cercando di fare più ripetizioni totali
 *    possibile. Si conta il totale e la volta dopo si prova a batterlo (il "record").
 *    Quando il totale supera il record precedente del 20% -> +5% di carico.
 *  - 3-6-9 (Chad Waterbury): le ripetizioni delle mini-serie ruotano di seduta in seduta:
 *    9 -> 6 -> 3 -> scarico -> 9 ... Carico di partenza: 10RM per le 9, 6RM per le 6, 5RM per
 *    le 3. Mai a cedimento: si lasciano 1-2 ripetizioni in riserva a ogni mini-serie.
 * La densità è complementare alla tensione meccanica: resta un protocollo scelto dall'utente,
 * non sostituisce il lavoro pesante.
 *
 * Scelta degli esercizi deterministica (stesso split e attrezzatura = stessi esercizi): serve
 * perché il record si confronta sulla STESSA coppia di esercizi fra una seduta e l'altra.
 */
import { isExerciseAvailable } from './equipment'
import type { CompletedWorkout, Equipment, EquipmentItem, Exercise, GeneratedWorkout, Muscle, PrescribedExercise } from '../types'

export type DensitySplit = 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body'
export const DENSITY_SPLIT_SUPPORTATI: DensitySplit[] = ['push', 'pull', 'legs', 'upper', 'lower', 'full_body']

export type FaseEdt = 9 | 6 | 3 | 'scarico'

interface Posto { muscle: Muscle; compound: boolean; patterns?: string[] }

/** Coppie per zona: antagonisti dove lo split li ha, altrimenti muscoli che non si disturbano
 *  (es. in Spinta il petto con il deltoide posteriore). */
const COPPIE: Record<DensitySplit, [Posto, Posto][]> = {
  push: [
    [{ muscle: 'chest', compound: true, patterns: ['horizontal_push'] }, { muscle: 'rear_delts', compound: false }],
    [{ muscle: 'chest', compound: true }, { muscle: 'lateral_delts', compound: false }],
    [{ muscle: 'triceps', compound: false }, { muscle: 'biceps', compound: false }],
  ],
  pull: [
    [{ muscle: 'back', compound: true, patterns: ['vertical_pull'] }, { muscle: 'triceps', compound: false }],
    [{ muscle: 'back', compound: true, patterns: ['horizontal_pull'] }, { muscle: 'lateral_delts', compound: false }],
    [{ muscle: 'biceps', compound: false }, { muscle: 'rear_delts', compound: false }],
  ],
  legs: [
    [{ muscle: 'quads', compound: true, patterns: ['squat'] }, { muscle: 'hamstrings', compound: false }],
    [{ muscle: 'quads', compound: false }, { muscle: 'glutes', compound: true }],
    [{ muscle: 'calves', compound: false }, { muscle: 'core', compound: false }],
  ],
  upper: [
    [{ muscle: 'chest', compound: true }, { muscle: 'back', compound: true, patterns: ['horizontal_pull'] }],
    [{ muscle: 'back', compound: true, patterns: ['vertical_pull'] }, { muscle: 'lateral_delts', compound: false }],
    [{ muscle: 'biceps', compound: false }, { muscle: 'triceps', compound: false }],
  ],
  lower: [
    [{ muscle: 'quads', compound: true, patterns: ['squat'] }, { muscle: 'hamstrings', compound: false }],
    [{ muscle: 'glutes', compound: true }, { muscle: 'quads', compound: false }],
    [{ muscle: 'calves', compound: false }, { muscle: 'core', compound: false }],
  ],
  full_body: [
    [{ muscle: 'quads', compound: true, patterns: ['squat'] }, { muscle: 'back', compound: true, patterns: ['horizontal_pull'] }],
    [{ muscle: 'chest', compound: true }, { muscle: 'hamstrings', compound: false }],
    [{ muscle: 'biceps', compound: false }, { muscle: 'triceps', compound: false }],
  ],
}

export interface EdtExercise {
  exercise_id: string
  name: string
  muscle: Muscle
  compound: boolean
  alternatives: { exercise_id: string; name: string }[]
  logged_weight_kg?: number
  reps_done: number
}

export interface EdtZone {
  /** Coppia di esercizi: la chiave del record (stessa coppia = stesso confronto). */
  key: string
  minutes: number
  pair: [EdtExercise, EdtExercise]
  /** Miglior totale di ripetizioni della zona con queste ripetizioni per mini-serie. */
  record: number | null
  /** L'ultima volta hai superato il record precedente del 20%: +5% di carico. */
  suggerisci_carico: boolean
}

export interface DensityEdtWorkout {
  name: string
  split: DensitySplit
  fase: FaseEdt
  /** Ripetizioni per mini-serie. */
  rep_target: number
  rir: string
  load_hint: string
  zones: EdtZone[]
  rest_between_min: number
  estimated_duration_min: number
}

export interface StoricoEdt {
  ultimaFase: FaseEdt | null
  /** chiave `${zone_key}|${rep_target}` -> totali in ordine cronologico */
  totali: Record<string, number[]>
}

export function prossimaFase(ultima: FaseEdt | null): FaseEdt {
  if (ultima === 9) return 6
  if (ultima === 6) return 3
  if (ultima === 3) return 'scarico'
  return 9
}

export function repTargetDi(fase: FaseEdt): number {
  return fase === 'scarico' ? 6 : fase
}

/** Legge dallo storico degli allenamenti completati la fase dell'ultima seduta Density e i
 *  totali per zona: record e rotazione restano su qualunque dispositivo. */
export function leggiStoricoEdt(completati: CompletedWorkout[]): StoricoEdt {
  const ordinati = [...completati].sort((a, b) => a.completed_at.localeCompare(b.completed_at))
  const totali: Record<string, number[]> = {}
  let ultimaFase: FaseEdt | null = null
  for (const c of ordinati) {
    const perZona = new Map<string, { rep: number; tot: number; fase: FaseEdt }>()
    for (const block of c.blocks ?? []) for (const e of block.exercises ?? []) {
      if (!e.edt) continue
      const k = e.edt.zone_key
      const prev = perZona.get(k) ?? { rep: e.edt.rep_target, tot: 0, fase: e.edt.fase }
      prev.tot += e.edt.reps_done
      perZona.set(k, prev)
    }
    if (perZona.size === 0) continue
    for (const [k, v] of perZona) {
      ultimaFase = v.fase
      if (v.fase === 'scarico') continue // lo scarico non conta per i record
      const chiave = `${k}|${v.rep}`
      ;(totali[chiave] ??= []).push(v.tot)
    }
  }
  return { ultimaFase, totali }
}

export interface DensityEdtConfig {
  split: DensitySplit
  equipment: Equipment
  available_equipment?: EquipmentItem[] | null
  excluded_exercises: string[]
  preferred_exercises?: string[]
  duration_min?: number
  fase?: FaseEdt
  storico?: StoricoEdt
}

const MINUTI_RISCALDAMENTO = 8

export function generaDensityEdt(catalog: Exercise[], cfg: DensityEdtConfig): DensityEdtWorkout | null {
  const fase = cfg.fase ?? prossimaFase(cfg.storico?.ultimaFase ?? null)
  const rep = repTargetDi(fase)
  const preferiti = new Set(cfg.preferred_exercises ?? [])
  const disponibili = catalog
    .filter((e) => !e.roles.includes('warmup'))
    .filter((e) => !cfg.excluded_exercises.includes(e.id))
    .filter((e) => isExerciseAvailable(e, cfg.equipment, cfg.available_equipment))
  const usati = new Set<string>()

  const scegli = (posto: Posto): EdtExercise | null => {
    const ruolo = posto.compound ? 'compound' : 'isolation'
    let candidati = disponibili.filter((e) => !usati.has(e.id) && e.primary_muscles[0] === posto.muscle && e.roles.includes(ruolo))
    if (candidati.length === 0) candidati = disponibili.filter((e) => !usati.has(e.id) && e.primary_muscles.includes(posto.muscle))
    if (candidati.length === 0) return null
    const conPattern = posto.patterns ? candidati.filter((e) => posto.patterns!.includes(e.movement_pattern)) : []
    const pool = conPattern.length ? conPattern : candidati
    // Deterministico: prima i preferiti, poi i più semplici tecnicamente (a mini-serie ripetute
    // per 15 minuti la tecnica deve reggere la fatica), poi per nome.
    pool.sort((a, b) => Number(preferiti.has(b.id)) - Number(preferiti.has(a.id)) ||
      a.technical_complexity - b.technical_complexity || a.name.localeCompare(b.name, 'it'))
    const scelto = pool[0]
    usati.add(scelto.id)
    return {
      exercise_id: scelto.id, name: scelto.name, muscle: posto.muscle, compound: posto.compound, reps_done: 0,
      alternatives: pool.slice(1, 6).map((e) => ({ exercise_id: e.id, name: e.name })),
    }
  }

  const scarico = fase === 'scarico'
  const nZone = scarico ? 2 : (cfg.duration_min ?? 60) >= 60 ? 3 : 2
  const minuti = scarico ? 10 : 15
  const zones: EdtZone[] = []
  for (const [a, b] of COPPIE[cfg.split].slice(0, nZone)) {
    const ea = scegli(a)
    const eb = scegli(b)
    if (!ea || !eb) continue
    const key = `${ea.exercise_id}+${eb.exercise_id}`
    const storia = scarico ? [] : cfg.storico?.totali[`${key}|${rep}`] ?? []
    const record = storia.length ? Math.max(...storia) : null
    const precedente = storia.length >= 2 ? Math.max(...storia.slice(0, -1)) : null
    zones.push({
      key, minutes: minuti, pair: [ea, eb], record,
      suggerisci_carico: precedente !== null && storia[storia.length - 1] >= precedente * 1.2,
    })
  }
  if (zones.length === 0) return null
  const pausa = 5
  return {
    name: scarico ? 'Density 3-6-9 · scarico' : `Density 3-6-9 · mini-serie da ${rep}`,
    split: cfg.split,
    fase,
    rep_target: rep,
    rir: scarico ? '3' : '1-2',
    load_hint: scarico ? 'carico leggero, lontano dal cedimento' : rep === 9 ? 'il carico del tuo 10RM' : rep === 6 ? 'il carico del tuo 6RM' : 'il carico del tuo 5RM',
    zones,
    rest_between_min: pausa,
    estimated_duration_min: MINUTI_RISCALDAMENTO + zones.length * minuti + (zones.length - 1) * pausa,
  }
}

/** Formato comune dell'app (storico, recupero settimanale): una zona = un blocco. */
export function densityEdtComeGeneratedWorkout(w: DensityEdtWorkout, durataSec?: number): GeneratedWorkout {
  const blocks = w.zones.map((z, i) => ({
    kind: 'main' as const,
    title: `Zona ${i + 1} · ${z.minutes} min`,
    exercises: z.pair.map((e): PrescribedExercise => ({
      exercise_id: e.exercise_id,
      name: e.name,
      role: e.compound ? 'compound' : 'isolation',
      muscle: e.muscle,
      sets: Math.max(1, Math.round(e.reps_done / w.rep_target) || Math.round((z.minutes * 60) / 90)),
      reps: String(w.rep_target),
      rest_sec: 15,
      rir: w.rir,
      logged_weight_kg: e.logged_weight_kg,
      note: 'edt',
      edt: { zone_key: z.key, fase: w.fase, rep_target: w.rep_target, reps_done: e.reps_done },
    })),
  }))
  return {
    name: w.name,
    mode: 'bodybuilding',
    split: w.split,
    goal: 'hypertrophy',
    experience: 'advanced',
    duration_min: durataSec ? Math.round(durataSec / 60) : w.estimated_duration_min,
    blocks,
    warnings: [],
  }
}
