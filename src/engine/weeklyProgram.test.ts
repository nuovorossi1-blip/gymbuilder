import { describe, expect, it } from 'vitest'
import { PRESET_EQUIPMENT } from '../generators/equipment'
import type { PublicMode, WeeklyProgramConfig } from '../types'
import { generateWeeklyProgram, updateWeeklySession } from './weeklyPlan'

const base: WeeklyProgramConfig = {
  training_days: 5, selected_modes: ['bodybuilding'], goal: 'hypertrophy', split_system: 'ppl',
  experience: 'advanced', duration_min: 60,
  equipment: { preset: 'full_gym', available: PRESET_EQUIPMENT.full_gym },
  weak_points: ['lateral_delts', 'biceps', 'triceps'],
  preferences: { excluded_exercise_ids: ['row_erg'], preferred_exercise_ids: [], bodyweight_policy: 'finisher_only', elastic_policy: 'never' },
  intensity: 'medium', crossfit_format: 'amrap',
  tabata: { work_sec: 20, rest_sec: 10, rounds: 8, prescription: 'time' },
}

const cases: [string, number, PublicMode[]][] = [
  ['A: 3 giorni BB + Hybrid', 3, ['bodybuilding', 'crossfit_hybrid']],
  ['B: 5 giorni BB + Hybrid', 5, ['bodybuilding', 'crossfit_hybrid']],
  ['C: 5 giorni BB + CrossFit Standard', 5, ['bodybuilding', 'crossfit']],
  ['D: 5 giorni BB + Forza + Hybrid', 5, ['bodybuilding', 'strength', 'crossfit_hybrid']],
  ['E: 6 giorni BB + Hybrid + Tabata', 6, ['bodybuilding', 'crossfit_hybrid', 'tabata']],
  ['F: 4 giorni Forza + Hybrid', 4, ['strength', 'crossfit_hybrid']],
  ['G: 5 giorni BB + Tabata', 5, ['bodybuilding', 'tabata']],
  ['H: 5 giorni CrossFit Standard + Hybrid', 5, ['crossfit', 'crossfit_hybrid']],
  ['I: 6 giorni BB + CrossFit Standard + Hybrid + Tabata', 6, ['bodybuilding', 'crossfit', 'crossfit_hybrid', 'tabata']],
]

describe('Weekly Program Engine', () => {
  it.each(cases)('%s genera tutti i giorni e include ogni disciplina', (_label, days, modes) => {
    const program = generateWeeklyProgram({ ...base, training_days: days, selected_modes: modes })
    expect(program.week).toHaveLength(days)
    expect(new Set(program.week.map((session) => session.day)).size).toBe(days)
    for (const mode of modes) expect(program.week.some((session) => session.mode === mode)).toBe(true)
    expect(program.config.weak_points).toEqual(base.weak_points)
    expect(program.config.equipment).toEqual(base.equipment)
    expect(program.config.preferences).toEqual(base.preferences)
  })

  it('5 giorni BB + Hybrid produce 3 sessioni Bodybuilding e 2 Hybrid', () => {
    const program = generateWeeklyProgram({ ...base, training_days: 5, selected_modes: ['bodybuilding', 'crossfit_hybrid'] })
    expect(program.week.filter((session) => session.mode === 'bodybuilding')).toHaveLength(3)
    expect(program.week.filter((session) => session.mode === 'crossfit_hybrid')).toHaveLength(2)
    expect(program.week.filter((session) => session.mode === 'bodybuilding').map((session) => session.split).sort()).toEqual(['legs', 'pull', 'push'])
    const hybrids = program.week.filter((session) => session.mode === 'crossfit_hybrid').map((session) => session.day)
    expect(hybrids).not.toEqual(['friday', 'saturday'])
  })

  it('PPL assegna spalle e braccia a Push/Pull, mai a Legs', () => {
    const program = generateWeeklyProgram({ ...base, training_days: 3, selected_modes: ['bodybuilding'], weak_points: ['lateral_delts', 'rear_delts', 'biceps', 'triceps'] })
    const bySplit = new Map(program.week.map((session) => [session.split, session]))
    expect(bySplit.get('push')?.priority_muscles).toEqual(['lateral_delts', 'biceps', 'triceps'])
    expect(bySplit.get('pull')?.priority_muscles).toEqual(['rear_delts', 'biceps', 'triceps'])
    expect(bySplit.get('legs')?.priority_muscles).toEqual([])
  })

  it('Upper/Lower ruota laterali e posteriori fra Upper A/B e lascia puliti i Lower', () => {
    const program = generateWeeklyProgram({ ...base, training_days: 4, selected_modes: ['bodybuilding'], split_system: 'upper_lower', weak_points: ['lateral_delts', 'rear_delts', 'biceps', 'triceps'] })
    const uppers = program.week.filter((session) => session.split === 'upper').sort((a, b) => a.variant.localeCompare(b.variant))
    expect(uppers.map((session) => session.priority_muscles)).toEqual([
      ['lateral_delts', 'biceps', 'triceps'],
      ['rear_delts', 'biceps', 'triceps'],
    ])
    expect(program.week.filter((session) => session.split === 'lower').every((session) => session.priority_muscles.length === 0)).toBe(true)
  })

  it('Front/Back assegna laterali al Front, posteriori al Back e richiama le braccia in entrambi', () => {
    const program = generateWeeklyProgram({ ...base, training_days: 4, selected_modes: ['bodybuilding'], split_system: 'front_back', weak_points: ['lateral_delts', 'rear_delts', 'biceps', 'triceps'] })
    for (const session of program.week) {
      if (session.split === 'front_body') expect(session.priority_muscles).toEqual(['lateral_delts', 'biceps', 'triceps'])
      if (session.split === 'back_body') expect(session.priority_muscles).toEqual(['rear_delts', 'biceps', 'triceps'])
    }
  })

  it('Bro Split usa giorni dedicati e richiami anatomici su Petto/Dorso, mai su Gambe', () => {
    const program = generateWeeklyProgram({ ...base, training_days: 5, selected_modes: ['bodybuilding'], split_system: 'bro_split', weak_points: ['lateral_delts', 'rear_delts', 'biceps', 'triceps'] })
    const bySplit = new Map(program.week.map((session) => [session.split, session.priority_muscles]))
    expect(bySplit.get('bro_chest')).toEqual(['lateral_delts', 'triceps'])
    expect(bySplit.get('bro_back')).toEqual(['rear_delts', 'biceps'])
    expect(bySplit.get('bro_shoulders')).toEqual(['lateral_delts', 'rear_delts'])
    expect(bySplit.get('bro_arms')).toEqual(['biceps', 'triceps'])
    expect(bySplit.get('bro_legs')).toEqual([])
  })

  it('Tabata resta complementare quando è combinato con altre discipline', () => {
    const program = generateWeeklyProgram({ ...base, training_days: 6, selected_modes: ['bodybuilding', 'crossfit_hybrid', 'tabata'] })
    expect(program.week.filter((session) => session.mode === 'tabata')).toHaveLength(1)
  })

  it('permette di modificare modalità, split e giorno e rivalida la settimana', () => {
    const program = generateWeeklyProgram({ ...base, selected_modes: ['bodybuilding', 'crossfit_hybrid'] })
    const target = program.week[0]
    const changed = updateWeeklySession(program, target.id, { mode: 'strength', split: 'upper', day: 'sunday' })
    expect(changed.week[0]).toMatchObject({ mode: 'strength', split: 'upper', day: 'sunday' })
    expect(changed.week[0].label).toContain('Forza')
  })

  it('rifiuta più discipline dei giorni disponibili', () => {
    expect(() => generateWeeklyProgram({ ...base, training_days: 3, selected_modes: ['bodybuilding', 'strength', 'crossfit', 'crossfit_hybrid'] })).toThrow()
  })
})
