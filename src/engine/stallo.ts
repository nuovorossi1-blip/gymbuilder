/**
 * Diario peso/girovita, stallo e ciclo delle calorie.
 *
 * Regola di Rossi (26/09, sostituisce il "mini surplus" del 23/09): tagliare all'infinito non
 * serve. L'app non decide: riconosce la situazione con criteri misurabili e PROPONE il ciclo,
 * Rossi lo accetta e l'app ricorda le calorie di ogni giorno.
 *  - In deficit: 4 settimane dall'ultimo cambio di calorie senza progressi (peso medio che non
 *    scende di almeno 0,1 kg a settimana e girovita che non cala di almeno 1 cm), oppure "mi
 *    sento piatto / la forza cala" dopo almeno 2 settimane -> PAUSA IN NORMOCALORICA: subito alla
 *    normocalorica per 2 settimane, poi giù a gradini di 250 kcal a settimana fino alle calorie
 *    di prima (es. 2000: 2500 per 14 giorni, 2250 per 7, 2000).
 *  - In surplus (simmetrico): peso che sale più di 0,5 kg a settimana per 2 settimane oppure
 *    girovita +2 cm -> PAUSA IN NORMOCALORICA per 2 settimane, poi su a gradini di 250 fino
 *    alle calorie di prima (es. 3000: 2500 per 14 giorni, 2750 per 7, 3000).
 * Il volume segue da solo (rampaVolume): "le calorie guidano".
 * Nota: i nomi interni 'mini_surplus' (dal deficit) e 'mini_cut' (dal surplus) restano per
 * compatibilità con i piani già salvati nel profilo.
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

export const GIORNI_PAUSA_NORMO = 14
export const SETTIMANE_STALLO_CUT = 4

/**
 * Il ciclo: subito alla normocalorica per 2 settimane, poi a gradini di 250 kcal a settimana
 * verso le calorie di partenza (in discesa dal deficit, in salita dal surplus).
 */
export function pianoScala(tipo: Stallo['tipo'], baseKcal: number, normoKcal?: number | null): Omit<LadderPlan, 'started_at'> {
  const d = tipo === 'mini_surplus' ? 250 : -250
  // Normocalorica ignota: si ricava dal vecchio schema (base +-500).
  const normo = normoKcal && Number.isFinite(normoKcal) ? Math.round(normoKcal) : baseKcal + 2 * d
  const gradini: LadderStep[] = [{ kcal: normo, giorni: GIORNI_PAUSA_NORMO }]
  let k = normo - d
  while (d > 0 ? k > baseKcal : k < baseKcal) {
    gradini.push({ kcal: k, giorni: GIORNI_GRADINO })
    k -= d
  }
  gradini.push({ kcal: baseKcal, giorni: GIORNI_GRADINO })
  return { tipo, base_kcal: baseKcal, gradini }
}

/**
 * @param entries voci del diario in ordine cronologico
 * @param calorieStep gradino calorico attuale rispetto alla normocalorica (null = fase ignota)
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
  const normo = kcal - calorieStep
  const inizio = dalCambio ? new Date(dalCambio).getTime() : 0
  const fase = entries
    .filter((entry) => new Date(entry.created_at).getTime() >= inizio && new Date(entry.created_at).getTime() <= now.getTime())
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const giorniDiDati = fase.length > 0 ? (now.getTime() - new Date(fase[0].created_at).getTime()) / DAY : 0
  const ultimaSettimana = fase.filter((entry) => now.getTime() - new Date(entry.created_at).getTime() <= 7 * DAY)
  const vite = fase.filter((entry) => entry.waist_cm != null)
  const deltaVita = vite.length >= 2 ? Number(vite[vite.length - 1].waist_cm) - Number(vite[0].waist_cm) : null

  if (calorieStep < 0) {
    if (giorniDiDati >= 14 && ultimaSettimana.some((entry) => entry.feels_flat)) {
      return { tipo: 'mini_surplus', motivo: 'Ti senti piatto o perdi forza: è il momento della pausa in normocalorica', piano: pianoScala('mini_surplus', kcal, normo) }
    }
    if (giorniDiDati < SETTIMANE_STALLO_CUT * 7) return null
    const ultime4 = fase.filter((entry) => now.getTime() - new Date(entry.created_at).getTime() <= SETTIMANE_STALLO_CUT * 7 * DAY + DAY)
    const slope = pendenzaSettimanale(ultime4)
    const pesoFermo = slope !== null && slope > -0.1
    const vitaFerma = deltaVita === null || deltaVita > -1
    if (pesoFermo && vitaFerma) {
      return {
        tipo: 'mini_surplus',
        motivo: `Da ${SETTIMANE_STALLO_CUT} settimane peso${deltaVita === null ? '' : ' e girovita'} non scendono: inutile tagliare ancora`,
        piano: pianoScala('mini_surplus', kcal, normo),
      }
    }
    return null
  }
  const ultime2 = fase.filter((entry) => now.getTime() - new Date(entry.created_at).getTime() <= 14 * DAY + DAY)
  const slope = giorniDiDati >= 14 ? pendenzaSettimanale(ultime2) : null
  if (slope !== null && slope > 0.5) {
    return { tipo: 'mini_cut', motivo: `Il peso sale di circa ${slope.toFixed(1)} kg a settimana (oltre 0,5): stai accumulando troppo grasso`, piano: pianoScala('mini_cut', kcal, normo) }
  }
  if (deltaVita !== null && deltaVita >= 2) {
    return { tipo: 'mini_cut', motivo: 'Il girovita è salito di 2 cm o più dall’inizio della fase', piano: pianoScala('mini_cut', kcal, normo) }
  }
  return null
}

/** Come si chiama la fase del ciclo per le persone (diario, Home, coach). */
export function nomeCiclo(tipo: Stallo['tipo']): string {
  return tipo === 'mini_surplus' ? 'Pausa in normocalorica (dal deficit)' : 'Pausa in normocalorica (dal surplus)'
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
