/**
 * Cartella del cliente: normalizzazione (da dati parziali, vecchi o scritti da un LLM), export
 * nel "file unico" .md e lettura di un .md caricato (Fase 2, 25/09).
 */
import { MUSCLE_LABELS, type Exercise, type Muscle, type Profile, type WeeklyProgram } from '../../types'
import { determinaFase, JOB_ACTIVITY_LABELS, JOINT_LABELS, STRESS_LABELS, type CalorieLogEntry } from '../../engine/nutrition'
import type { BodyEntry } from '../../engine/stallo'
import { CARTELLA_VUOTA, type CartellaCliente, type EsercizioNota, type NotaMuscolo } from './types'
import { REGOLE_COACH } from './coachRules'

const MUSCOLI = Object.keys(MUSCLE_LABELS) as Muscle[]
const str = (v: unknown, max = 600) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const num = (v: unknown) => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[] : [])

/** Riconosce un muscolo dall'id ("lateral_delts") o dal nome italiano ("deltoidi laterali"). */
export function muscoloDa(v: unknown): Muscle | null {
  const t = str(v).toLowerCase()
  if (!t) return null
  if (MUSCOLI.includes(t as Muscle)) return t as Muscle
  return MUSCOLI.find((m) => MUSCLE_LABELS[m].toLowerCase().startsWith(t) || t.includes(MUSCLE_LABELS[m].toLowerCase().split(' ·')[0])) ?? null
}

const normNome = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Id del catalogo per un nome scritto a mano o da un LLM (esatto, poi contenuto). */
export function abbinaEsercizio(nome: string, catalog: Exercise[]): string | undefined {
  const n = normNome(nome)
  if (!n) return undefined
  const byId = catalog.find((e) => e.id === nome.trim())
  if (byId) return byId.id
  const esatto = catalog.find((e) => normNome(e.name) === n)
  if (esatto) return esatto.id
  const contiene = catalog.filter((e) => normNome(e.name).includes(n) || n.includes(normNome(e.name)))
  return contiene.length === 1 ? contiene[0].id : undefined
}

function noteMuscoli(v: unknown): NotaMuscolo[] {
  return arr(v).map((x) => ({ muscolo: muscoloDa(x.muscolo), note: str(x.note) })).filter((x): x is NotaMuscolo => !!x.muscolo)
}

function esercizi(v: unknown, catalog?: Exercise[]): EsercizioNota[] {
  return arr(v).map((x) => {
    const nome = str(x.nome, 120)
    const id = str(x.exercise_id, 80) || (catalog ? abbinaEsercizio(nome, catalog) : undefined)
    return { nome, exercise_id: id || undefined, nota: str(x.nota) || undefined }
  }).filter((x) => x.nome)
}

export function normalizzaCartella(raw: unknown, catalog?: Exercise[]): CartellaCliente {
  const c = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const ob = (c.obiettivo && typeof c.obiettivo === 'object' ? c.obiettivo : {}) as Record<string, unknown>
  const risc = (c.riscaldamento && typeof c.riscaldamento === 'object' ? c.riscaldamento : {}) as Record<string, unknown>
  const macro = (c.macro && typeof c.macro === 'object' ? c.macro : {}) as Record<string, unknown>
  return {
    versione: 1,
    livello_note: str(c.livello_note),
    obiettivo: { primario: str(ob.primario), secondario: str(ob.secondario), indiretto: str(ob.indiretto) },
    vincoli: arr(c.vincoli).map((v) => ({
      zona: str(v.zona, 80), problema: str(v.problema), strategia: str(v.strategia),
      vietati: (Array.isArray(v.vietati) ? v.vietati : typeof v.vietati === 'string' ? v.vietati.split(',') : []).map((x) => str(x, 120)).filter(Boolean),
    })).filter((v) => v.zona || v.problema),
    carenze: noteMuscoli(c.carenze),
    punti_forti: noteMuscoli(c.punti_forti),
    esercizi_ok: esercizi(c.esercizi_ok, catalog),
    esercizi_perdita_tensione: esercizi(c.esercizi_perdita_tensione, catalog),
    obbligatori: arr(c.obbligatori).map((x) => ({
      ...esercizi([x], catalog)[0] ?? { nome: '' },
      seduta: str(x.seduta, 40) || undefined,
      slot: num(x.slot) ?? undefined,
    })).filter((x) => x.nome),
    attrezzatura: (Array.isArray(c.attrezzatura) ? c.attrezzatura : []).map((x) => str(x, 80)).filter(Boolean),
    riscaldamento: {
      descrizione: str(risc.descrizione) || CARTELLA_VUOTA.riscaldamento.descrizione,
      minuti: num(risc.minuti) ?? CARTELLA_VUOTA.riscaldamento.minuti,
    },
    macro: { proteine_g: num(macro.proteine_g), grassi_g: num(macro.grassi_g), carboidrati_g: num(macro.carboidrati_g) },
    note_coach: str(c.note_coach, 3000),
    controlli: arr(c.controlli).map((k) => ({
      data: str(k.data, 30), peso: num(k.peso) ?? undefined, girovita: num(k.girovita) ?? undefined,
      specchio: str(k.specchio) || undefined, energia: str(k.energia) || undefined, recupero: str(k.recupero) || undefined,
      sonno: str(k.sonno) || undefined, fame: str(k.fame) || undefined, fastidi: str(k.fastidi) || undefined,
      carichi: arr(k.carichi).map((x) => ({ esercizio: str(x.esercizio, 120), carico: str(x.carico, 40), reps: str(x.reps, 40) })),
      decisioni: str(k.decisioni, 3000) || undefined,
    })).filter((k) => k.data),
  }
}

/** Esercizi vietati dai vincoli tassativi, riconosciuti nel catalogo: il motore li esclude. */
export function vietatiDallaCartella(c: CartellaCliente | null, catalog: Exercise[]): string[] {
  if (!c) return []
  return [...new Set(c.vincoli.flatMap((v) => v.vietati).map((n) => abbinaEsercizio(n, catalog)).filter((x): x is string => !!x))]
}

/** Esercizi che il cliente sente bene: preferiti per il motore. */
export function preferitiDallaCartella(c: CartellaCliente | null): string[] {
  if (!c) return []
  return [...new Set([...c.esercizi_ok, ...c.obbligatori].map((e) => e.exercise_id).filter((x): x is string => !!x))]
}

const INIZIO_JSON = '<!-- GYMBUILDER-CARTELLA-JSON'
const FIRMA = 'firma:'

/** Impronta del testo: se al reimport non coincide, il testo è stato modificato (da te o da un
 *  altro LLM) e va letto, non basta il JSON. */
export function impronta(testo: string): string {
  let h = 5381
  const t = testo.replace(/\s+/g, ' ').trim()
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
const FINE_JSON = 'GYMBUILDER-CARTELLA-JSON -->'

const riga = (celle: (string | number | undefined | null)[]) => `| ${celle.map((c) => String(c ?? '').replace(/\|/g, '/').replace(/\n/g, ' ')).join(' | ')} |`
const tabella = (intestazione: string[], righe: (string | number | undefined | null)[][]) =>
  righe.length ? [riga(intestazione), riga(intestazione.map(() => '---')), ...righe.map(riga)].join('\n') : '_Nessun dato._'

export interface DatiExport {
  cartella: CartellaCliente
  profile: Profile | null
  calorieLog: CalorieLogEntry[]
  bodyLog: BodyEntry[]
  program: WeeklyProgram | null
  /** Piano del Coach attivo (Fase 4): se c'è, è lui la "scheda attuale" del file. */
  coachPlan?: { titolo: string; giorni_settimana: number; note?: string; sedute: { nome: string; logica?: string; esercizi: { nome: string; serie: number; reps: string; rir: string; tecnica?: string; nota?: string; alternativa?: string }[] }[] } | null
  nome?: string
}

/** Il "file unico" di Rossi: qualsiasi LLM lo legge e diventa il coach. In fondo un blocco JSON
 *  nascosto permette di reimportarlo nell'app senza perdere nulla. */
export function cartellaInMarkdown(d: DatiExport): string {
  const { cartella: c, profile: p } = d
  const fase = determinaFase(p, d.calorieLog)
  const oggi = new Date().toISOString().slice(0, 10)
  const out: string[] = []
  out.push('# COACHING BODYBUILDING NATURAL — CARTELLA COMPLETA', '')
  out.push('> Istruzioni: incolla tutto questo file in qualsiasi LLM. Leggerà tutto e farà da coach.', `> Esportata da GymBuilder il ${oggi}.`, '')
  out.push('# PARTE 1 — REGOLE DEL COACH', '', REGOLE_COACH, '')
  out.push('# PARTE 2 — IL CLIENTE', '', '## Dati')
  out.push(tabella(['Voce', 'Valore'], [
    ['Nome', d.nome ?? p?.display_name ?? ''],
    ['Sesso', p?.sex === 'male' ? 'Maschio' : p?.sex === 'female' ? 'Femmina' : ''],
    ['Età', p?.age], ['Altezza (cm)', p?.height_cm], ['Peso (kg)', p?.weight_kg],
    ['Lavoro', p?.job_activity ? JOB_ACTIVITY_LABELS[p.job_activity] : ''],
    ['Sonno (ore)', p?.sleep_hours], ['Stress', p?.stress_level ? STRESS_LABELS[p.stress_level] : ''],
    ['Livello ed esperienza', c.livello_note],
    ['Fastidi articolari', (p?.joint_issues ?? []).map((j) => JOINT_LABELS[j]).join(', ')],
  ]), '')
  out.push('## Vincoli tassativi', tabella(['Zona', 'Problema', 'Vietato', 'Strategia'], c.vincoli.map((v) => [v.zona, v.problema, v.vietati.join(', '), v.strategia])), '')
  out.push('## Carenze (priorità massima)', tabella(['Muscolo', 'Note'], c.carenze.map((x) => [MUSCLE_LABELS[x.muscolo], x.note])), '')
  out.push('## Punti forti (mantenimento)', tabella(['Muscolo', 'Note'], c.punti_forti.map((x) => [MUSCLE_LABELS[x.muscolo], x.note])), '')
  out.push('## Obiettivo', tabella(['', ''], [['Primario', c.obiettivo.primario], ['Secondario', c.obiettivo.secondario], ['Indiretto', c.obiettivo.indiretto]]), '')
  out.push('## Esercizi che sente bene', tabella(['Esercizio', 'Nota'], c.esercizi_ok.map((e) => [e.nome, e.nota])), '')
  out.push('## Esercizi con perdita di tensione', tabella(['Esercizio', 'Soluzione'], c.esercizi_perdita_tensione.map((e) => [e.nome, e.nota])), '')
  out.push('## Esercizi obbligatori (il coach può spostarli di posizione)', tabella(['Esercizio', 'Seduta', 'Slot'], c.obbligatori.map((e) => [e.nome, e.seduta, e.slot])), '')
  out.push('## Attrezzatura disponibile', c.attrezzatura.length ? c.attrezzatura.map((a) => `- ${a}`).join('\n') : '_Non indicata._', '')
  out.push('## Riscaldamento fisso (non conta negli esercizi)', `${c.riscaldamento.descrizione} (~${c.riscaldamento.minuti} min)`, '')
  out.push('# PARTE 3 — NUTRIZIONE', '')
  out.push(tabella(['Voce', 'Valore'], [
    ['Calorie attuali', p?.daily_kcal ? `${p.daily_kcal} kcal` : ''],
    ['Normocalorica', fase?.maintenance_kcal ? `~${fase.maintenance_kcal} kcal (${fase.maintenance_source})` : ''],
    ['Fase', fase?.summary ?? ''],
    ['Proteine (g/die)', c.macro.proteine_g], ['Grassi (g/die)', c.macro.grassi_g], ['Carboidrati (g/die)', c.macro.carboidrati_g],
  ]), '')
  out.push('## Storico calorie', tabella(['Data', 'Kcal', 'Gradino'], d.calorieLog.slice(-10).map((e) => [e.created_at.slice(0, 10), e.kcal, e.step])), '')
  out.push('## Peso e girovita', tabella(['Data', 'Peso', 'Girovita', 'Piatto'], d.bodyLog.slice(-12).map((e) => [e.created_at.slice(0, 10), e.weight_kg, e.waist_cm, e.feels_flat ? 'sì' : ''])), '')
  out.push('# PARTE 4 — LA SCHEDA ATTUALE', '')
  if (d.coachPlan) {
    out.push(`**${d.coachPlan.titolo}** — rotazione di ${d.coachPlan.sedute.length} sedute, ${d.coachPlan.giorni_settimana} a settimana (si fa sempre la prossima della lista).`)
    if (d.coachPlan.note) out.push('', d.coachPlan.note)
    for (const sd of d.coachPlan.sedute) {
      out.push('', `### ${sd.nome}`, tabella(['#', 'Esercizio', 'Serie×Reps', 'RIR', 'Tecnica', 'Perché lì', 'Alternativa'], sd.esercizi.map((e, i) => [i + 1, e.nome, `${e.serie}×${e.reps}`, e.rir, e.tecnica, e.nota, e.alternativa])))
      if (sd.logica) out.push('', `**Logica:** ${sd.logica}`)
    }
  } else if (d.program) {
    out.push(tabella(['#', 'Seduta', 'Disciplina', 'Carenze'], d.program.week.map((s, i) => [i + 1, s.label, s.mode, s.priority_muscles.map((m) => MUSCLE_LABELS[m]).join(', ')])))
    for (const s of d.program.week) {
      const main = s.generated_workout?.blocks.find((b) => b.kind === 'main')
      if (!main) continue
      out.push('', `### ${s.label}`, tabella(['#', 'Muscolo', 'Serie×Reps', 'RIR', 'Esercizio'], main.exercises.map((e, i) => [i + 1, e.muscle ? MUSCLE_LABELS[e.muscle] : '', `${e.sets}×${e.reps}`, e.rir, e.name])))
    }
  } else out.push('_Nessun piano ancora: lo costruirà il Coach._')
  out.push('', '# PARTE 5 — STORICO CONTROLLI', '')
  if (c.controlli.length === 0) out.push('_Nessun controllo ancora._')
  for (const k of c.controlli) {
    out.push(`## Controllo del ${k.data}`, tabella(['Voce', 'Valore'], [
      ['Peso', k.peso], ['Girovita', k.girovita], ['Specchio', k.specchio], ['Energia', k.energia], ['Recupero', k.recupero],
      ['Sonno', k.sonno], ['Fame', k.fame], ['Fastidi', k.fastidi],
    ]))
    if (k.carichi?.length) out.push('', tabella(['Esercizio', 'Carico', 'Reps'], k.carichi.map((x) => [x.esercizio, x.carico, x.reps])))
    if (k.decisioni) out.push('', `**Decisioni:** ${k.decisioni}`)
    out.push('')
  }
  if (c.note_coach) out.push('## Note del coach', c.note_coach, '')
  out.push('# PARTE 6 — COSA DEVE FARE IL COACH', '',
    'Se è un controllo: di\' che hai letto tutto il diario, poi fai queste domande (una o due alla volta).',
    'CORPO: 1) peso medio degli ultimi 7 giorni; 2) girovita all\'ombelico, al mattino a digiuno.',
    'SPECCHIO: 3) come ti vedi rispetto all\'inizio; 4) un muscolo che vedi crescere; 5) un muscolo fermo o che non senti.',
    'PALESTRA: 6) energia e motivazione; 7) carichi in salita, stabili o in calo (su quali esercizi); 8) fastidi articolari nuovi o peggiorati.',
    'ALIMENTAZIONE: 9) calorie rispettate, fame, momenti di fame incontrollabile; 10) sonno e stress rispetto all\'inizio.',
    '',
    'Poi: 1. Valutazione del trend rispetto allo storico. 2. Decisioni con il perché (calorie, volume, esercizi, RIR, articolazioni) secondo le regole di decisione.',
    '3. Scheda aggiornata solo dei giorni che cambiano, con la logica e il perché di ogni esercizio. 4. Obiettivi delle prossime 4 settimane (peso, girovita, carichi chiave).',
    '5. Il file intero aggiornato, con il controllo aggiunto allo storico. Se il cliente chiede perché hai scelto un esercizio o una posizione, spiegalo.', '')
  const testo = out.join('\n')
  // Il blocco nascosto porta cartella E programma: il file si ricarica identico in qualsiasi
  // momento, indipendentemente dall'LLM scelto.
  const dati = { cartella: c, piano: d.coachPlan ?? null }
  return [testo, `${INIZIO_JSON} ${FIRMA}${impronta(testo)}`, JSON.stringify(dati), FINE_JSON, ''].join('\n')
}

export interface LetturaMarkdown {
  /** Dati esatti del blocco JSON, se presente e leggibile. */
  cartella: CartellaCliente | null
  /** Programma del Coach contenuto nel file (grezzo: va normalizzato con il catalogo). */
  piano: unknown
  /** true se il testo è stato cambiato dopo l'esportazione: va letto dall'LLM. */
  testoModificato: boolean
}

/** Legge un file .md caricato: il blocco JSON di GymBuilder (se c'è) e se il testo intorno è
 *  stato modificato dopo l'esportazione. */
export function leggiMarkdown(md: string, catalog?: Exercise[]): LetturaMarkdown {
  const i = md.indexOf(INIZIO_JSON)
  const j = md.indexOf(FINE_JSON)
  if (i < 0 || j < i) return { cartella: null, piano: null, testoModificato: true }
  const intestazione = md.slice(i, md.indexOf('\n', i))
  const firma = intestazione.split(FIRMA)[1]?.trim()
  const corpo = md.slice(i + intestazione.length, j).trim()
  const testo = md.slice(0, i).replace(/\n+$/, '')
  let cartella: CartellaCliente | null
  let piano: unknown = null
  try {
    const dati = JSON.parse(corpo) as Record<string, unknown>
    // Formato del 25/09 {cartella, piano}; i file precedenti contengono solo la cartella.
    const conPiano = dati && typeof dati === 'object' && 'cartella' in dati
    cartella = normalizzaCartella(conPiano ? dati.cartella : dati, catalog)
    piano = conPiano ? dati.piano ?? null : null
  } catch { cartella = null }
  return { cartella, piano, testoModificato: !firma || impronta(testo) !== firma }
}
