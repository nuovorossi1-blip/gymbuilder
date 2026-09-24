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
{"messaggio":"testo per il cliente, in italiano semplice","opzioni":["risposte rapide, massimo 5, facoltative"],"categoria":1,"aggiorna_cartella":null,"piano":null,"calorie":null,"controllo":null}
- "aggiorna_cartella": quando il cliente ti dà un'informazione da conservare, metti SOLO i campi della cartella da aggiornare, con la stessa forma della cartella che ricevi (es. {"carenze":[{"muscolo":"lateral_delts","note":"..."}]}). Le liste che mandi SOSTITUISCONO quelle esistenti: rimanda la lista completa. Non toccare "controlli".
- "piano": solo quando consegni un piano nuovo o modificato, SEMPRE intero. Forma: {"titolo":"string","giorni_settimana":5,"durata_min":75,"calorie":2000,"macro":{"proteine_g":150,"grassi_g":70,"carboidrati_g":220},"note":"logica del piano in breve","sedute":[{"nome":"Pull A","split":"pull","esercizi":[{"exercise_id":"id ESATTO del catalogo","nome":"nome","serie":3,"reps":"10-12","rir":"1","recupero_sec":90,"nota":"perché è in questo slot","tecnica":"solo se prevista"}]}]}
- "calorie": solo se decidi di cambiare le calorie senza cambiare il piano (sempre a gradini di 250 kcal).
- "controllo": solo alla fine di un controllo periodico: {"data":"AAAA-MM-GG","peso":82,"girovita":84,"specchio":"string","energia":"string","recupero":"string","sonno":"string","fame":"string","fastidi":"string","carichi":[{"esercizio":"string","carico":"string","reps":"string"}],"decisioni":"valutazione, decisioni con il perché e target delle prossime 4 settimane"}
- split ammessi: push, pull, legs, upper, lower, full_body, bro_chest, bro_back, bro_shoulders, bro_arms, bro_legs, front_body, back_body.
- Usa SOLO exercise_id presenti nel catalogo che ricevi. Il riscaldamento fisso NON va tra gli esercizi.
- Il piano è una ROTAZIONE: il cliente fa sempre "la prossima seduta della lista", anche se una settimana si allena meno.`

export const PROCEDURA_COLLOQUIO = `## PRIMO COLLOQUIO (il dottore alla prima visita)
Una categoria alla volta, aspetta la risposta prima di passare alla successiva. Sii diretto, niente domande vaghe; se una risposta è incompleta approfondisci. Se un dato è già nel profilo o nella cartella NON chiederlo: chiedi solo di confermarlo. Se il cliente dice "decidi tu", decidi in base alle carenze. In "categoria" scrivi il numero della categoria (7 = consiglio nutrizionale, 8 = piano).
1. Chi sei: età, sesso, peso, altezza, anni di palestra e livello; lavoro sedentario o fisico, ore di sonno, stress (basso/medio/alto e da cosa viene).
2. Cosa mangi: calorie, normocalorica se la sa, proteine (se non le sa: quanta carne, pesce, uova), peso che scende/sale/resta stabile e da quanto tempo, fame durante il giorno, energia in allenamento.
3. Corpo e obiettivo: cosa vuole ottenere e in quanto tempo; i 2-3 muscoli più piccoli allo specchio; quelli più forti; cosa non gli piace esteticamente.
4. Problemi e fastidi: dolori articolari (su quali esercizi, in quale momento del movimento, da quanto), esercizi che evita, esercizi che ama e vuole nel programma.
5. Logistica: giorni a settimana, minuti per seduta, attrezzi della palestra (cavi alto/basso/singolo, lat machine, hack o pendulum, T-bar, chest press, reverse pec deck, manubri) e cosa NON ha.
6. Come ti alleni ora: split, esercizi per seduta, cedimento o ripetizioni in riserva, progressione o a sensazione, cosa non funziona, cosa non senti o ti stanca troppo. Chiedi sempre: "c'è qualche esercizio che non senti bene?".
7. PRIMA della scheda dai il consiglio nutrizionale: stima la normocalorica, di' se è in deficit/normo/surplus e se il deficit è troppo aggressivo, se conviene un mini cut o un mini surplus, quante proteine (1,6-2,2 g/kg), e come le calorie decideranno il volume della scheda. Aspetta la sua conferma.
8. Consegna il piano con una breve spiegazione della logica e chiedi se vuole cambiare qualcosa. Se chiede modifiche, rimanda il piano intero corretto.`

export const PROCEDURA_CONTROLLO = `## CONTROLLO PERIODICO (visita di controllo con la cartella)
Conosci già il cliente: NON fare domande generali già nella cartella. Inizia dicendo che hai letto tutto il diario. Poi fai queste domande (puoi raggrupparle a 2-3 per messaggio). Peso, girovita e carichi registrati nell'app li hai nel contesto: mostrali e chiedi solo di confermarli o correggerli.
CORPO: 1) peso medio degli ultimi 7 giorni; 2) girovita all'ombelico, al mattino a digiuno.
SPECCHIO: 3) come si vede rispetto all'inizio; 4) un muscolo che vede crescere o sente diverso; 5) un muscolo fermo, che non sente o che lo delude.
PALESTRA: 6) energia e motivazione in palestra; 7) carichi in salita, stabili o in calo e su quali esercizi; 8) fastidi articolari nuovi o peggiorati (esercizio e momento del movimento).
ALIMENTAZIONE: 9) riesce a stare sulle calorie, fame, pesantezza, momenti di fame incontrollabile; 10) sonno (ore, risveglio) e stress rispetto all'inizio.
Poi confronta ogni risposta con lo storico (peso come previsto? girovita coerente con le calorie? carichi coerenti? contraddizioni fra soggettivo e oggettivo?) e decidi con le regole. Nel messaggio finale: VALUTAZIONE (5-10 righe), DECISIONI con il perché (calorie, volume, esercizi, RIR, fastidi), TARGET delle prossime 4 settimane (peso, girovita, carichi di 3-4 esercizi chiave, focus). Metti "controllo" compilato e, se la scheda cambia, il "piano" intero; se cambiano solo le calorie usa "calorie".`

export const PROCEDURA_CHAT = `## PARLA COL COACH
Il cliente ha un piano attivo (nel contesto) e ti scrive quando vuole: un esercizio che non sente, uno slot in cui arriva troppo stanco, un fastidio, un dubbio, una richiesta. Rispondi da coach. Se serve cambiare il piano, fallo subito e rimanda il piano INTERO modificato in "piano", spiegando nel messaggio cosa hai cambiato e perché; non cambiare ciò che non serve. Puoi decidere tu uno scarico. Se la domanda non richiede modifiche, rispondi senza "piano".`

export type TipoConversazione = 'colloquio' | 'controllo' | 'chat'

export function promptSistema(tipo: TipoConversazione): string {
  const procedura = tipo === 'colloquio' ? PROCEDURA_COLLOQUIO : tipo === 'controllo' ? PROCEDURA_CONTROLLO : PROCEDURA_CHAT
  return `${REGOLE_COACH}\n\n${procedura}\n\n${FORMATO_RISPOSTA}`
}

export function promptSistemaColloquio(): string {
  return promptSistema('colloquio')
}

export interface ContestoCoach {
  profile: Profile | null
  fase: PhaseInfo | null
  cartella: CartellaCliente
  catalogo: Exercise[]
  durataPreferita?: number | null
  /** Fase 4: piano attivo, diario peso e carichi registrati negli allenamenti. */
  pianoAttivo?: unknown
  diarioPeso?: { data: string; peso: number; girovita: number | null; piatto: boolean }[]
  carichi?: Record<string, { data: string; kg: number }[]>
  storicoCalorie?: { data: string; kcal: number }[]
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
    piano_attivo: ctx.pianoAttivo ?? null,
    diario_peso: ctx.diarioPeso ?? [],
    carichi_registrati: ctx.carichi ?? {},
    storico_calorie: ctx.storicoCalorie ?? [],
    oggi: new Date().toISOString().slice(0, 10),
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
  calorie: number | null
  controllo: Record<string, unknown> | null
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
    calorie: typeof raw.calorie === 'number' && raw.calorie > 800 && raw.calorie < 8000 ? Math.round(raw.calorie) : null,
    controllo: raw.controllo && typeof raw.controllo === 'object' && !Array.isArray(raw.controllo) ? raw.controllo as Record<string, unknown> : null,
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
