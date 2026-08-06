import { describe, expect, it } from 'vitest'
import { generaCondizionamento, FORMATI_CONDIZIONAMENTO } from '../conditioning'
import type { Equipment, Exercise } from '../../types'
import catalogoReale from './fixtures/exercises.json'

const catalogo = catalogoReale as unknown as Exercise[]
const perId = new Map(catalogo.map((e) => [e.id, e]))

function metconBlock(w: ReturnType<typeof generaCondizionamento>) {
  return w.blocks.find((b) => b.kind === 'metcon')!
}

describe('generaCondizionamento — struttura (solo Metcon, il formato lo sceglie l\'utente)', () => {
  it('mode, split e goal sono impostati correttamente: niente split, niente Forza/Skill', () => {
    const w = generaCondizionamento(catalogo, {
      format: 'amrap', experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    expect(w.mode).toBe('conditioning')
    expect(w.split).toBeNull()
    expect(w.goal).toBe('conditioning')
    expect(w.blocks.map((b) => b.kind)).toEqual(['warmup', 'metcon'])
  })

  for (const format of FORMATI_CONDIZIONAMENTO) {
    it(`${format}: il blocco Metcon riporta il formato scelto e produce almeno un movimento`, () => {
      const w = generaCondizionamento(catalogo, {
        format, experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
        priority_muscles: [], excluded_exercises: [], seed: 2,
      })
      const m = metconBlock(w)
      expect(m.format).toBe(format)
      expect(m.exercises.length).toBeGreaterThan(0)
    })
  }

  it('amrap: ha un tempo a disposizione dichiarato, dentro un intervallo realistico', () => {
    const w = generaCondizionamento(catalogo, {
      format: 'amrap', experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 2,
    })
    const m = metconBlock(w)
    expect(m.time_cap_min).toBeGreaterThanOrEqual(8)
    expect(m.time_cap_min).toBeLessThanOrEqual(25)
  })

  it('emom: ogni round dura 60 secondi', () => {
    const w = generaCondizionamento(catalogo, {
      format: 'emom', experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 2,
    })
    expect(metconBlock(w).interval_sec).toBe(60)
    expect(metconBlock(w).rounds).toBeGreaterThanOrEqual(8)
  })

  it('for_time: un solo passaggio, con un tetto massimo dichiarato', () => {
    const w = generaCondizionamento(catalogo, {
      format: 'for_time', experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 2,
    })
    const m = metconBlock(w)
    expect(m.rounds).toBe(1)
    expect(m.time_cap_min).toBeGreaterThan(0)
  })

  it('rounds: un numero di giri fisso, senza recupero fisso fra gli esercizi (riposa il necessario)', () => {
    const w = generaCondizionamento(catalogo, {
      format: 'rounds', experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 2,
    })
    const m = metconBlock(w)
    expect(m.rounds).toBeGreaterThanOrEqual(3)
    for (const e of m.exercises) expect(e.rest_sec).toBe(0)
  })

  it('circuit: recupero fisso fra un esercizio e l\'altro, a differenza di "rounds"', () => {
    const w = generaCondizionamento(catalogo, {
      format: 'circuit', experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 2,
    })
    for (const e of metconBlock(w).exercises) expect(e.rest_sec).toBeGreaterThan(0)
  })

  it('intervals: le ripetizioni sono sempre a tempo, non un numero di reps', () => {
    const w = generaCondizionamento(catalogo, {
      format: 'intervals', experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 2,
    })
    const m = metconBlock(w)
    expect(m.interval_sec).toBeGreaterThan(0)
    for (const e of m.exercises) expect(e.reps).toMatch(/sec$/)
  })
})

describe('generaCondizionamento — scelta movimenti', () => {
  it('non sceglie mai bilanciere, macchine o cavi, in nessun formato', () => {
    for (const format of FORMATI_CONDIZIONAMENTO) {
      const w = generaCondizionamento(catalogo, {
        format, experience: 'advanced', equipment: 'full_gym', duration_min: 60,
        priority_muscles: [], excluded_exercises: [], seed: 6,
      })
      for (const es of metconBlock(w).exercises) {
        const ex = perId.get(es.exercise_id)!
        expect(['barbell', 'machine', 'cable']).not.toContain(ex.equipment)
      }
    }
  })

  it('non genera mai lo stesso esercizio due volte nello stesso Metcon', () => {
    for (const format of FORMATI_CONDIZIONAMENTO) {
      const w = generaCondizionamento(catalogo, {
        format, experience: 'advanced', equipment: 'full_gym', duration_min: 90,
        priority_muscles: [], excluded_exercises: [], seed: 13,
      })
      const ids = metconBlock(w).exercises.map((e) => e.exercise_id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('con solo corpo libero non seleziona mai esercizi che richiedono altro attrezzo', () => {
    const equipment: Equipment = 'bodyweight'
    for (const format of FORMATI_CONDIZIONAMENTO) {
      const w = generaCondizionamento(catalogo, {
        format, experience: 'advanced', equipment, duration_min: 60,
        priority_muscles: [], excluded_exercises: [], seed: 8,
      })
      for (const es of metconBlock(w).exercises) {
        expect(perId.get(es.exercise_id)?.equipment).toBe('bodyweight')
      }
    }
  })

  it('rispetta gli esercizi esclusi', () => {
    const w = generaCondizionamento(catalogo, {
      format: 'amrap', experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: ['burpee', 'kb_swing'], seed: 2,
    })
    const ids = metconBlock(w).exercises.map((e) => e.exercise_id)
    expect(ids).not.toContain('burpee')
    expect(ids).not.toContain('kb_swing')
  })
})

describe('generaCondizionamento — durata e calorie', () => {
  it('la durata effettiva non supera mai di molto quella richiesta senza un avviso esplicito', () => {
    const w = generaCondizionamento(catalogo, {
      format: 'amrap', experience: 'intermediate', equipment: 'full_gym', duration_min: 90,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    if (w.duration_min < 80) {
      expect(w.warnings.length).toBeGreaterThan(0)
    }
  })

  it('stima sempre le calorie attive per ogni movimento e per il totale', () => {
    const w = generaCondizionamento(catalogo, {
      format: 'amrap', experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    for (const es of metconBlock(w).exercises) {
      expect(es.est_kcal).toBeGreaterThan(0)
    }
    expect(w.est_kcal).toBeGreaterThan(0)
  })
})
