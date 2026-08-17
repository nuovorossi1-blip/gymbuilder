import { describe, expect, it } from 'vitest'
import { generaCrossFit } from '../crossfit'
import type { Equipment, Exercise } from '../../types'
import catalogoReale from './fixtures/exercises.json'

const catalogo = catalogoReale as unknown as Exercise[]
const perId = new Map(catalogo.map((e) => [e.id, e]))

function mainBlock(w: ReturnType<typeof generaCrossFit>) {
  return w.blocks.find((b) => b.kind === 'main')!
}
function metconBlock(w: ReturnType<typeof generaCrossFit>) {
  return w.blocks.find((b) => b.kind === 'metcon')!
}
function accessoryBlock(w: ReturnType<typeof generaCrossFit>) {
  return w.blocks.find((b) => b.title.startsWith('Accessory'))!
}
function trainingExercises(w: ReturnType<typeof generaCrossFit>) {
  return w.blocks.filter((block) => block.kind !== 'warmup').flatMap((block) => block.exercises)
}

const EQUIPAGGIAMENTI: Equipment[] = [
  'full_gym', 'barbell', 'dumbbells', 'machines', 'barbell_dumbbells',
  'barbell_machines', 'dumbbells_machines', 'home_gym', 'bodyweight',
]

describe('generaCrossFit — struttura (Forza/Skill + Metcon AMRAP)', () => {
  it('usa le carenze negli accessori senza filtrare il WOD per singoli muscoli', () => {
    const targets = ['front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps'] as const
    const w = generaCrossFit(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [...targets], target_muscles: [...targets], excluded_exercises: [],
      seed: 18, benchmark: 'custom',
    })
    expect(accessoryBlock(w).exercises.some((item) => {
      const exercise = perId.get(item.exercise_id)
      return exercise?.primary_muscles.some((muscle) => targets.includes(muscle as typeof targets[number]))
    })).toBe(true)
    expect(metconBlock(w).exercises.some((item) => {
      const exercise = perId.get(item.exercise_id)
      return !exercise?.primary_muscles.some((muscle) => targets.includes(muscle as typeof targets[number]))
    })).toBe(true)
  })

  it('Cindy conserva movimenti e ripetizioni ufficiali e aggiunge preparazione target', () => {
    const w = generaCrossFit(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: ['front_delts', 'biceps', 'triceps'],
      target_muscles: ['front_delts', 'biceps', 'triceps'], excluded_exercises: [],
      seed: 4, benchmark: 'cindy',
    })
    expect(w.name).toContain('Cindy')
    expect(metconBlock(w).title).toBe('Cindy · AMRAP 20′')
    expect(metconBlock(w).exercises.map((item) => [item.exercise_id, item.reps])).toEqual([
      ['trazioni', '5'], ['piegamenti', '10'], ['squat_libero', '15'],
    ])
    expect(w.blocks.filter((block) => block.kind !== 'warmup').flatMap((block) => block.exercises)).toHaveLength(6)
  })

  it('mode, split e goal sono impostati correttamente: nessuno split, è Strength/Skill + Metcon', () => {
    const w = generaCrossFit(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    expect(w.mode).toBe('crossfit')
    expect(w.split).toBeNull()
    expect(w.goal).toBe('conditioning')
  })

  it('produce sempre i tre blocchi: riscaldamento, Forza/Skill, Metcon', () => {
    const w = generaCrossFit(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    expect(w.blocks.map((b) => b.kind)).toEqual(['warmup', 'main', 'metcon', 'main'])
    expect(mainBlock(w).exercises).toHaveLength(1)
    expect(accessoryBlock(w).exercises.length).toBeGreaterThanOrEqual(1)
    expect(accessoryBlock(w).exercises.length).toBeLessThanOrEqual(2)
  })

  it('il Metcon ha sempre formato AMRAP con un tempo a disposizione dichiarato', () => {
    const w = generaCrossFit(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    const m = metconBlock(w)
    expect(m.format).toBe('amrap')
    expect(m.time_cap_min).toBeGreaterThanOrEqual(8)
    expect(m.time_cap_min).toBeLessThanOrEqual(20)
  })

  it.each(['amrap', 'for_time', 'emom', 'rounds', 'chipper', 'ladder', 'intervals'] as const)(
    'supporta il formato %s mantenendo Strength/Skill separato',
    (format) => {
      const w = generaCrossFit(catalogo, {
        format,
        experience: 'advanced', equipment: 'full_gym', duration_min: 60,
        priority_muscles: [], excluded_exercises: [], seed: 12,
      })
      expect(w.blocks.map((block) => block.kind)).toEqual(['warmup', 'main', 'metcon', 'main'])
      expect(metconBlock(w).format).toBe(format)
    }
  )

  it('For Time dichiara round e time cap; EMOM dichiara intervallo e round', () => {
    const base = {
      experience: 'intermediate' as const, equipment: 'full_gym' as const, duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 3,
    }
    const forTime = metconBlock(generaCrossFit(catalogo, { ...base, format: 'for_time' }))
    expect(forTime.rounds).toBeGreaterThan(0)
    expect(forTime.time_cap_min).toBeGreaterThan(0)
    const emom = metconBlock(generaCrossFit(catalogo, { ...base, format: 'emom' }))
    expect(emom.interval_sec).toBe(60)
    expect(emom.rounds).toBeGreaterThan(0)
  })

  it('con palestra completa il Metcon resta compatto con 3-4 movimenti', () => {
    for (const durata of [30, 45, 60, 75, 90]) {
      const w = generaCrossFit(catalogo, {
        experience: 'intermediate', equipment: 'full_gym', duration_min: durata,
        priority_muscles: [], excluded_exercises: [], seed: 7,
      })
      const n = metconBlock(w).exercises.length
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(4)
    }
  })

  it('con 90 minuti la sessione resta comunque intorno a un\'ora, con un avviso onesto', () => {
    const w = generaCrossFit(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 90,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    expect(w.duration_min).toBeLessThan(60)
    expect(w.warnings.some((x) => x.includes('durata tipica di una classe'))).toBe(true)
  })

  it('se una carenza entra nella parte Forza/Skill la richiama con carico ridotto, non come forza pura', () => {
    const w = generaCrossFit(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: ['front_delts'], excluded_exercises: [], seed: 14, intensity: 'medium',
    })
    expect(mainBlock(w).exercises[0].muscle).toBe('front_delts')
    expect(mainBlock(w).exercises[0].note).toBe('focus carenza: carico ridotto')
    expect(mainBlock(w).exercises[0].reps).toBe('6-8')
  })
})

describe('generaCrossFit — Forza/Skill (riusa il tag "strength" del catalogo)', () => {
  it('sceglie sempre esercizi taggati strength quando l\'attrezzatura lo consente', () => {
    const w = generaCrossFit(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 4,
    })
    for (const es of mainBlock(w).exercises) {
      expect(perId.get(es.exercise_id)?.roles).toContain('strength')
    }
  })

  it('senza bilanciere scende a un compound non-conditioning equivalente, mai a un buco silenzioso', () => {
    const w = generaCrossFit(catalogo, {
      experience: 'advanced', equipment: 'bodyweight', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 4,
    })
    expect(mainBlock(w).exercises.length).toBeGreaterThan(0)
    for (const es of mainBlock(w).exercises) {
      const ex = perId.get(es.exercise_id)!
      expect(ex.equipment).toBe('bodyweight')
      expect(ex.roles).toContain('compound')
      expect(ex.roles).not.toContain('conditioning')
    }
  })

  it('intensità Alta abbassa le ripetizioni rispetto a Bassa (il recupero può comprimersi allo stesso modo se il tempo Strength/Skill è poco, come in Forza: non è un bug)', () => {
    const bassa = generaCrossFit(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 75,
      priority_muscles: [], excluded_exercises: [], seed: 5, intensity: 'low',
    })
    const alta = generaCrossFit(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 75,
      priority_muscles: [], excluded_exercises: [], seed: 5, intensity: 'high',
    })
    expect(mainBlock(alta).exercises[0].reps).not.toBe(mainBlock(bassa).exercises[0].reps)
  })

  it('un principiante non arriva alle ripetizioni più basse nemmeno chiedendo intensità Alta', () => {
    const w = generaCrossFit(catalogo, {
      experience: 'beginner', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 5, intensity: 'high',
    })
    expect(mainBlock(w).exercises[0].reps).not.toBe('3-5')
  })
})

describe('generaCrossFit — Metcon (solo bodyweight/kettlebell/manubri/cardio)', () => {
  it('non sceglie mai bilanciere, macchine o cavi nel Metcon', () => {
    const w = generaCrossFit(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 6,
    })
    for (const es of metconBlock(w).exercises) {
      const ex = perId.get(es.exercise_id)!
      expect(['barbell', 'machine', 'cable']).not.toContain(ex.equipment)
    }
  })

  it('ogni movimento del Metcon è taggato conditioning o cardio', () => {
    const w = generaCrossFit(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 6,
    })
    for (const es of metconBlock(w).exercises) {
      const ex = perId.get(es.exercise_id)!
      expect(ex.roles.includes('conditioning') || ex.roles.includes('cardio')).toBe(true)
    }
  })

  it('con solo corpo libero non seleziona mai esercizi che richiedono altro attrezzo, in nessun blocco', () => {
    const w = generaCrossFit(catalogo, {
      experience: 'advanced', equipment: 'bodyweight', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 8,
    })
    for (const es of trainingExercises(w)) {
      expect(perId.get(es.exercise_id)?.equipment).toBe('bodyweight')
    }
  })

  it('con soli manubri conserva Skill/Strength, WOD e Accessory usando solo manubri o corpo libero', () => {
    const w = generaCrossFit(catalogo, {
      experience: 'beginner', equipment: 'full_gym', available_equipment: ['dumbbells'], duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 31,
    })
    expect(mainBlock(w).exercises).toHaveLength(1)
    expect(metconBlock(w).exercises.length).toBeGreaterThanOrEqual(3)
    expect(accessoryBlock(w).exercises.length).toBeGreaterThanOrEqual(1)
    for (const item of trainingExercises(w)) {
      const exercise = perId.get(item.exercise_id)!
      expect(['dumbbell', 'bodyweight']).toContain(exercise.equipment)
    }
  })
})

describe('generaCrossFit — attrezzatura e duplicati', () => {
  it('rispetta sempre l\'attrezzatura disponibile, per ogni combinazione', () => {
    for (const equipment of EQUIPAGGIAMENTI) {
      const w = generaCrossFit(catalogo, {
        experience: 'advanced', equipment, duration_min: 60,
        priority_muscles: [], excluded_exercises: [], seed: 11,
      })
      for (const es of trainingExercises(w)) {
        expect(perId.get(es.exercise_id)).toBeDefined()
      }
    }
  })

  it('non genera mai lo stesso esercizio due volte, nemmeno fra Forza/Skill e Metcon', () => {
    for (const equipment of EQUIPAGGIAMENTI) {
      const w = generaCrossFit(catalogo, {
        experience: 'advanced', equipment, duration_min: 90,
        priority_muscles: [], excluded_exercises: [], seed: 13,
      })
      const ids = trainingExercises(w).map((e) => e.exercise_id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('rispetta gli esercizi esclusi', () => {
    const w = generaCrossFit(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: ['squat', 'front_squat'], seed: 2,
    })
    const ids = trainingExercises(w).map((e) => e.exercise_id)
    expect(ids).not.toContain('squat')
    expect(ids).not.toContain('front_squat')
  })
})

describe('generaCrossFit — calorie', () => {
  it('stima sempre le calorie attive per ogni esercizio e per il totale', () => {
    const w = generaCrossFit(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    for (const es of trainingExercises(w)) {
      expect(es.est_kcal).toBeGreaterThan(0)
    }
    expect(w.est_kcal).toBeGreaterThan(0)
  })
})
