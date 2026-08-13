import { describe, expect, it } from 'vitest'
import { generaHybrid } from '../hybrid'
import type { Equipment, Exercise } from '../../types'
import catalogoReale from './fixtures/exercises.json'

const catalogo = catalogoReale as unknown as Exercise[]
const perId = new Map(catalogo.map((e) => [e.id, e]))

function mainBlock(w: ReturnType<typeof generaHybrid>) {
  return w.blocks.find((b) => b.kind === 'main')!
}
function metconBlock(w: ReturnType<typeof generaHybrid>) {
  return w.blocks.find((b) => b.kind === 'metcon')!
}

const EQUIPAGGIAMENTI: Equipment[] = [
  'full_gym', 'barbell', 'dumbbells', 'machines', 'barbell_dumbbells',
  'barbell_machines', 'dumbbells_machines', 'home_gym', 'bodyweight',
]

describe('generaHybrid — struttura Strength/Bodybuilding + Hybrid Metcon', () => {
  it('mode, split e goal sono impostati correttamente: niente split, è forza+cardio alternati', () => {
    const w = generaHybrid(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    expect(w.mode).toBe('crossfit_hybrid')
    expect(w.split).toBeNull()
    expect(w.goal).toBe('mixed')
  })

  it('produce tre blocchi separati: riscaldamento, forza e Metcon', () => {
    const w = generaHybrid(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    expect(w.blocks.map((b) => b.kind)).toEqual(['warmup', 'main', 'metcon'])
  })

  it('supporta metodiche AMRAP, EMOM, For Time e Intervals sugli esercizi bodybuilding', () => {
    for (const format of ['amrap', 'emom', 'for_time', 'intervals'] as const) {
      const workout = generaHybrid(catalogo, {
        experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
        priority_muscles: [], excluded_exercises: [], seed: 1, format,
      })
      expect(metconBlock(workout).format).toBe(format)
      expect(metconBlock(workout).exercises.some((exercise) => exercise.note === 'isolamento')).toBe(true)
    }
  })

  it('nel Metcon cardio e isolamento si alternano', () => {
    for (const durata of [30, 45, 60, 75, 90]) {
      const w = generaHybrid(catalogo, {
        experience: 'intermediate', equipment: 'full_gym', duration_min: durata,
        priority_muscles: [], excluded_exercises: [], seed: 3,
      })
      const note = metconBlock(w).exercises.map((e) => e.note)
      for (let i = 0; i < note.length; i++) {
        expect(note[i]).toBe(i % 2 === 0 ? 'cardio' : 'isolamento')
      }
    }
  })

  it('il volume cresce con la durata', () => {
    const corta = generaHybrid(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 30,
      priority_muscles: [], excluded_exercises: [], seed: 9,
    })
    const lunga = generaHybrid(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 90,
      priority_muscles: [], excluded_exercises: [], seed: 9,
    })
    const count = (w: ReturnType<typeof generaHybrid>) => mainBlock(w).exercises.length + metconBlock(w).exercises.length
    expect(count(lunga)).toBeGreaterThan(count(corta))
  })

  it('se un compound Hybrid colpisce una carenza usa una prescrizione piu prudente', () => {
    const w = generaHybrid(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: ['back'], excluded_exercises: [], seed: 5, intensity: 'medium',
    })
    expect(mainBlock(w).exercises[0].muscle).toBe('back')
    expect(mainBlock(w).exercises[0].note).toBe('focus carenza: carico ridotto')
    expect(mainBlock(w).exercises[0].reps).toBe('10-15')
  })
})

describe('generaHybrid — scelta esercizi', () => {
  it('non apre mai con affondi o unilaterali quando esiste un compound bilaterale', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const w = generaHybrid(catalogo, {
        experience: 'advanced', equipment: 'full_gym', duration_min: 60,
        priority_muscles: ['quads'], excluded_exercises: [], seed,
      })
      const first = perId.get(mainBlock(w).exercises[0].exercise_id)!
      expect(first.movement_pattern).not.toBe('lunge')
      expect(first.unilateral).not.toBe(true)
    }
  })

  it('le alzate sono sempre compound (hypertrophy o strength), mai movimenti conditioning', () => {
    const w = generaHybrid(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 4,
    })
    for (const es of mainBlock(w).exercises.filter((e) => e.role === 'compound')) {
      const ex = perId.get(es.exercise_id)!
      expect(ex.roles).toContain('compound')
      expect(ex.roles.includes('hypertrophy') || ex.roles.includes('strength')).toBe(true)
    }
  })

  it('le scariche cardio non usano mai bilanciere, macchine o cavi', () => {
    const w = generaHybrid(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 4,
    })
    for (const es of metconBlock(w).exercises.filter((e) => e.note === 'cardio')) {
      const ex = perId.get(es.exercise_id)!
      expect(['barbell', 'machine', 'cable']).not.toContain(ex.equipment)
    }
  })

  it('gli isolamenti nel Metcon sono semplici e a bassa fatica sistemica', () => {
    const w = generaHybrid(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 14,
    })
    for (const es of metconBlock(w).exercises.filter((e) => e.note === 'isolamento')) {
      const exercise = perId.get(es.exercise_id)!
      expect(exercise.roles).toContain('isolation')
      expect(exercise.technical_complexity).toBeLessThanOrEqual(1)
      expect(exercise.systemic_fatigue).toBeLessThanOrEqual(1)
      expect(exercise.grip_fatigue).toBeLessThanOrEqual(2)
    }
  })

  it('produce sempre esercizi validi (presenti nel catalogo) per ogni combinazione di attrezzatura', () => {
    for (const equipment of EQUIPAGGIAMENTI) {
      const w = generaHybrid(catalogo, {
        experience: 'advanced', equipment, duration_min: 60,
        priority_muscles: [], excluded_exercises: [], seed: 11,
      })
      for (const es of [...mainBlock(w).exercises, ...metconBlock(w).exercises]) {
        expect(perId.get(es.exercise_id)).toBeDefined()
      }
    }
  })

  it('con solo corpo libero non seleziona mai esercizi che richiedono altro attrezzo', () => {
    const w = generaHybrid(catalogo, {
      experience: 'advanced', equipment: 'bodyweight', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 8,
    })
    for (const es of [...mainBlock(w).exercises, ...metconBlock(w).exercises]) {
      expect(perId.get(es.exercise_id)?.equipment).toBe('bodyweight')
    }
  })

  it('non genera mai lo stesso esercizio due volte nella sessione', () => {
    for (const equipment of EQUIPAGGIAMENTI) {
      const w = generaHybrid(catalogo, {
        experience: 'advanced', equipment, duration_min: 90,
        priority_muscles: [], excluded_exercises: [], seed: 13,
      })
      const ids = [...mainBlock(w).exercises, ...metconBlock(w).exercises].map((e) => e.exercise_id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('rispetta gli esercizi esclusi', () => {
    const w = generaHybrid(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: ['panca_piana', 'squat'], seed: 2,
    })
    const ids = [...mainBlock(w).exercises, ...metconBlock(w).exercises].map((e) => e.exercise_id)
    expect(ids).not.toContain('panca_piana')
    expect(ids).not.toContain('squat')
  })

  it('la prima coppia della rotazione tocca un muscolo prioritario, se indicato', () => {
    const w = generaHybrid(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: ['back'], excluded_exercises: [], seed: 5,
    })
    expect(mainBlock(w).exercises[0].muscle).toBe('back')
  })
})

describe('generaHybrid — calorie', () => {
  it('stima sempre le calorie attive per ogni esercizio e per il totale', () => {
    const w = generaHybrid(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    for (const es of [...mainBlock(w).exercises, ...metconBlock(w).exercises]) {
      expect(es.est_kcal).toBeGreaterThan(0)
    }
    expect(w.est_kcal).toBeGreaterThan(0)
  })
})
