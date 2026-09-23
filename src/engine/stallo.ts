/**
 * Blocco 3 (23/09): diario peso/girovita, stallo e scala proposta (Principio 11 di Rossi).
 *
 * L'app non decide: riconosce lo stallo con criteri misurabili e PROPONE una scala di gradini da
 * 250 kcal; Rossi la accetta e poi l'app ricorda quando è il momento del gradino successivo.
 *  - In cut (gradino <= -250): peso fermo da 2+ settimane (calo < 0,1 kg/sett) oppure "mi sento
 *    piatto / la forza cala" nell'ultima settimana -> MINI SURPLUS: +250, +500, poi ridiscesa.
 *  - In bulk (gradino >= +250): peso che sale > 0,5 kg/sett oppure girovita +2 cm dall'inizio
 *    della fase -> MINI CUT: -250, -500, poi risalita.
 * Ogni gradino dura 7 giorni. Il volume segue comunque da solo (rampaVolume): la scala delle
 * calorie e quella del volume restano sfasate come vuole la regola "le calorie guidano".
 */
export interface BodyEntry {
  weight_kg: number
  waist_cm: number | null
  feels_flat: boolean
  created_at: string
}

export interface LadderStep { kcal: number; giorni: number }

export interface LadderPlan {
  tipo: 'mini_cut' | 'mini_surplus'
  base_kcal: number
  gradini: LadderStep[]
  started_at: string
}

export interface Stallo {
  tipo: 'mini_cut' | 'mini_surplus'
  motivo: string
  piano: Omit<LadderPlan, 'started_at'>
}

const DAY = 86_400_000
export const GIORNI_GRADINO = 7

/** Pendenza in kg/settimana (regressione lineare) delle voci nell'intervallo. */
export function pendenzaSettimanale(entries: BodyEntry[]): number | null {
  if (entries.length < 3) return null
  const t0 = new Date(entries[0].created_at).getTime()
  const xs = entries.map((entry) => (new Date(entry.created_at).getTime() - t0) / (7 * DAY))
  const ys = entries.map((entry) => Number(entry.weight_kg))
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  const den = xs.reduce((acc, x) => acc + (x - mx) ** 2, 0)
  if (den === 0) return null
  return xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0) / den
}

export function pianoScala(tipo: Stallo['tipo'], baseKcal: number): Omit<LadderPlan, 'started_at'> {
  const d = tipo === 'mini_surplus' ? 250 : -250
  const kcal = [baseKcal + d, baseKcal + 2 * d, baseKcal + d, baseKcal]
  return { tipo, base_kcal: baseKcal, gradini: kcal.map((k) => ({ kcal: k, giorni: GIORNI_GRADINO })) }
}

/**
 * @param entries voci del diario in ordine cronologico
 * @param calorieStep gradino calorico attuale (null = fase ignota: nessuna analisi)
 * @param kcal calorie attuali
 * @param dalCambio data dell'ultimo cambio di calorie (la fase si misura da lì)
 */
export function analizzaStallo(
  entries: BodyEntry[],
  calorieStep: number | null,
  kcal: number | null,
  dalCambio: string | null,
  now: Date = new Date(),
): Stallo | null {
  if (calorieStep === null || !kcal || calorieStep === 0) return null
  const inizio = dalCambio ? new Date(dalCambio).getTime() : 0
  const fase = entries
    .filter((entry) => new Date(entry.created_at).getTime() >= inizio && new Date(entry.created_at).getTime() <= now.getTime())
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const ultimaSettimana = fase.filter((entry) => now.getTime() - new Date(entry.created_at).getTime() <= 7 * DAY)
  const ultime2 = fase.filter((entry) => now.getTime() - new Date(entry.created_at).getTime() <= 14 * DAY + DAY)
  const copre2Settimane = fase.length > 0 && now.getTime() - new Date(fase[0].created_at).getTime() >= 14 * DAY
  const slope = copre2Settimane ? pendenzaSettimanale(ultime2) : null

  if (calorieStep < 0) {
    if (ultimaSettimana.some((entry) => entry.feels_flat)) {
      return { tipo: 'mini_surplus', motivo: 'Hai segnalato di sentirti piatto o di perdere forza', piano: pianoScala('mini_surplus', kcal) }
    }
    if (slope !== null && slope > -0.1) {
      return { tipo: 'mini_surplus', motivo: 'Il peso è fermo da almeno 2 settimane', piano: pianoScala('mini_surplus', kcal) }
    }
    return null
  }
  if (slope !== null && slope > 0.5) {
    return { tipo: 'mini_cut', motivo: `Il peso sale di circa ${slope.toFixed(1)} kg a settimana (oltre 0,5)`, piano: pianoScala('mini_cut', kcal) }
  }
  const vite = fase.filter((entry) => entry.waist_cm != null)
  if (vite.length >= 2 && Number(vite[vite.length - 1].waist_cm) - Number(vite[0].waist_cm) >= 2) {
    return { tipo: 'mini_cut', motivo: 'Il girovita è salito di 2 cm o più dall’inizio della fase', piano: pianoScala('mini_cut', kcal) }
  }
  return null
}

/** Calorie previste oggi dal piano accettato; null se concluso o non ancora iniziato. */
export function gradinoDiOggi(plan: LadderPlan | null | undefined, now: Date = new Date()): { kcal: number; indice: number; totale: number; fineTra: number } | null {
  if (!plan?.gradini?.length) return null
  let t = new Date(plan.started_at).getTime()
  if (!Number.isFinite(t) || now.getTime() < t) return null
  for (let i = 0; i < plan.gradini.length; i++) {
    const fine = t + plan.gradini[i].giorni * DAY
    if (now.getTime() < fine) return { kcal: plan.gradini[i].kcal, indice: i + 1, totale: plan.gradini.length, fineTra: Math.ceil((fine - now.getTime()) / DAY) }
    t = fine
  }
  return null
}
