/**
 * Prompt del Coach (Fase 3, 25/09). Il sistema = regole del Coach (cartella/coachRules.ts) +
 * procedura del primo colloquio (le 6 categorie del prompt di Rossi) + formato di risposta JSON.
 */
import { REGOLE_COACH } from '../cartella/coachRules'
import { normalizzaCartella } from '../cartella/cartella'
import type { CartellaCliente } from '../cartella/types'
import type { Exercise, Profile } from '../../types'
import type { PhaseInfo } from '../../engine/nutrition'

export const FORMATO_RISPOSTA = `Rispondi SEMPRE e SOLO con un JSON object:
{"messaggio":"testo per il cliente, in italiano semplice","opzioni":["risposte rapide, massimo 5, facoltative"],"categoria":1,"aggiorna_cartella":null,"piano":null}
- "aggiorna_cartella": quando il cliente ti dà un'informazione da conservare, metti SOLO i campi della cartella da aggiornare, con la stessa forma della cartella che ricevi (es. {"carenze":[{"muscolo":"lateral_delts","note":"..."}]}). Le liste che mandi SOSTITUISCONO quelle esistenti: rimanda la lista completa.
- "piano": solo quando hai tutte le informazioni. Forma: {"titolo":"string","giorni_settimana":5,"durata_min":75,"calorie":2000,"macro":{"proteine_g":150,"grassi_g":70,"carboidrati_g":220},"note":"logica del piano in breve","sedute":[{"nome":"Pull A","split":"pull","esercizi":[{"exercise_id":"id ESATTO del catalogo","nome":"nome","serie":3,"reps":"10-12","rir":"1","recupero_sec":90,"nota":"perché è in questo slot","tecnica":"solo se prevista"}]}]}
- split ammessi: push, pull, legs, upper, lower, full_body, bro_chest, bro_back, bro_shoulders, bro_arms, bro_legs, front_body, back_body.
- Usa SOLO exercise_id presenti nel catalogo che ricevi. Il riscaldamento fisso NON va tra gli esercizi.
- Il piano è una ROTAZIONE: il cliente fa sempre "la prossima seduta della lista", anche se una settimana si allena meno.`

export const PROCEDURA_COLLOQUIO = `## PRIMO COLLOQUIO
Stai facendo il primo colloquio. Una categoria alla volta, aspetta la risposta prima di passare alla successiva. Se un dato è già nel profilo o nella cartella NON chiederlo: chiedi solo di confermarlo. Se il cliente dice "decidi tu", decidi in base alle carenze. In "categoria" scrivi il numero della categoria che stai facendo (7 quando consegni il piano).
1. Profilo base: età, sesso, peso, anni di palestra, lavoro, sonno, stress.
2. Nutrizione: calorie, normocalorica, fase, obiettivo di peso, proteine. Proponi calorie e macronutrienti (proteine 1,6-2,2 g/kg).
3. Carenze e fastidi: 2-3 muscoli più carenti, punti forti, cosa non piace esteticamente, dolori articolari (quali movimenti evitare).
4. Logistica: giorni a settimana (3-6), durata massima della seduta, split preferito, esercizi per seduta.
5. Esercizi: obbligatori, vietati, preferenze di attrezzi, attrezzatura della palestra, esercizi che sente bene e quelli dove perde tensione. Chiedi sempre: "c'è qualche esercizio che non senti bene?".
6. Distribuzione: quanti esercizi per gruppo, richiami antagonisti, ordine preferito (se il cliente propone un ordine, analizzalo prima di proporre il tuo).
Poi consegna il piano con una breve spiegazione della logica, e chiedi se vuole cambiare qualcosa. Se il cliente chiede modifiche, rimanda il piano intero corretto.`

export function promptSistemaColloquio(): string {
  return `${REGOLE_COACH}\n\n${PROCEDURA_COLLOQUIO}\n\n${FORMATO_RISPOSTA}`
}

export interface ContestoCoach {
  profile: Profile | null
  fase: PhaseInfo | null
  cartella: CartellaCliente
  catalogo: Exercise[]
  durataPreferita?: number | null
}

/** Il contesto va come primo messaggio: il coach lo "legge" prima della conversazione. */
export function messaggioContesto(ctx: ContestoCoach): string {
  const p = ctx.profile
  return JSON.stringify({
    profilo: p ? {
      nome: p.display_name, sesso: p.sex, eta: p.age, altezza_cm: p.height_cm, peso_kg: p.weight_kg,
      lavoro: p.job_activity, sonno_ore: p.sleep_hours, stress: p.stress_level, fastidi_articolari: p.joint_issues ?? [],
      calorie: p.daily_kcal, andamento_peso: p.weight_trend,
    } : null,
    fase: ctx.fase ? {
      riassunto: ctx.fase.summary, normocalorica: ctx.fase.maintenance_kcal,
      gradino_calorie: ctx.fase.calorie_step, gradino_volume: ctx.fase.training_step,
    } : null,
    cartella: normalizzaCartella(ctx.cartella),
    catalogo: ctx.catalogo.filter((e) => !e.roles.includes('warmup')).map((e) => ({
      id: e.id, nome: e.name, muscoli: e.primary_muscles, attrezzo: e.equipment, multiarticolare: e.roles.includes('compound'),
    })),
  })
}

export interface RispostaCoach {
  messaggio: string
  opzioni: string[]
  categoria: number | null
  aggiorna_cartella: Record<string, unknown> | null
  piano: unknown
}

export function leggiRispostaCoach(raw: Record<string, unknown>): RispostaCoach {
  const opz = Array.isArray(raw.opzioni) ? raw.opzioni.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 5) : []
  const cat = typeof raw.categoria === 'number' ? raw.categoria : Number(raw.categoria)
  return {
    messaggio: typeof raw.messaggio === 'string' && raw.messaggio.trim() ? raw.messaggio.trim() : 'Non ho capito bene, puoi ripetere?',
    opzioni: opz,
    categoria: Number.isFinite(cat) ? cat : null,
    aggiorna_cartella: raw.aggiorna_cartella && typeof raw.aggiorna_cartella === 'object' && !Array.isArray(raw.aggiorna_cartella) ? raw.aggiorna_cartella as Record<string, unknown> : null,
    piano: raw.piano && typeof raw.piano === 'object' ? raw.piano : null,
  }
}

/** Unisce l'aggiornamento proposto dal coach alla cartella (le liste inviate sostituiscono). */
export function unisciCartella(attuale: CartellaCliente, patch: Record<string, unknown> | null, catalog: Exercise[]): CartellaCliente {
  if (!patch) return attuale
  const unita: Record<string, unknown> = { ...attuale }
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in attuale) || k === 'versione' || k === 'controlli') continue
    const corrente = (attuale as unknown as Record<string, unknown>)[k]
    unita[k] = v && typeof v === 'object' && !Array.isArray(v) && corrente && typeof corrente === 'object' && !Array.isArray(corrente)
      ? { ...corrente, ...v }
      : v
  }
  return normalizzaCartella(unita, catalog)
}
