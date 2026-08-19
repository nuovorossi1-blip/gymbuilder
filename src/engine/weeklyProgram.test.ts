import { describe, expect, it } from 'vitest'
import { PRESET_EQUIPMENT } from '../generators/equipment'
import type { PublicMode, WeeklyProgramConfig } from '../types'
import { applyAutomaticProgramming, generateWeeklyProgram, selectProgramMode, updateWeeklySession } from './weeklyPlan'

const base: WeeklyProgramConfig = {
  program_kind: 'program', duration_weeks: 4,
  training_days: 5, selected_modes: ['bodybuilding'], goal: 'hypertrophy', split_system: 'ppl',
  experience: 'advanced', duration_min: 60,
  equipment: { preset: 'full_gym', available: PRESET_EQUIPMENT.full_gym },
  weak_points: ['lateral_delts', 'biceps', 'triceps'],
  preferences: { excluded_exercise_ids: ['row_erg'], preferred_exercise_ids: [], bodyweight_policy: 'finisher_only', elastic_policy: 'never' },
  intensity: 'medium', crossfit_format: 'amrap',
  single_session_split: 'push', hybrid_balance: 'bb_dominant',
  tabata: { work_sec: 20, rest_sec: 10, rounds: 8, prescription: 'time' },
}

const cases: [string, number, PublicMode[]][] = [
  ['A: 3 giorni BB + Hybrid', 3, ['bodybuilding', 'crossfit_hybrid']],
  ['B: 5 giorni BB + Hybrid', 5, ['bodybuilding', 'crossfit_hybrid']],
  ['C: 5 giorni BB + CrossFit Standard', 5, ['bodybuilding', 'crossfit']],
  ['F: 4 giorni Forza + Hybrid', 4, ['strength', 'crossfit_hybrid']],
  ['G: 5 giorni BB + Tabata', 5, ['bodybuilding', 'tabata']],
  ['H: 5 giorni CrossFit Standard + Hybrid', 5, ['crossfit', 'crossfit_hybrid']],
]

describe('Selezione discipline', () => {
  it('sostituisce la seconda disciplina quando se ne seleziona una terza', () => {
    expect(selectProgramMode(['bodybuilding', 'crossfit_hybrid'], 'crossfit')).toEqual(['bodybuilding', 'crossfit'])
    expect(selectProgramMode(['bodybuilding'], 'strength')).toEqual(['bodybuilding', 'strength'])
    expect(selectProgramMode(['bodybuilding', 'strength'], 'strength')).toEqual(['bodybuilding'])
  })
})

describe('Programmazione automatica', () => {
  it('sceglie metodo e intensità senza richiederli all’utente', () => {
    const strengthCrossFit = applyAutomaticProgramming({ ...base, selected_modes: ['strength', 'crossfit'], duration_min: 60 })
    expect(strengthCrossFit.goal).toBe('mixed')
    expect(strengthCrossFit.strength_method).toBe('strength_accessories')
    expect(strengthCrossFit.crossfit_format).toBe('for_time')

    const beginnerBb = applyAutomaticProgramming({ ...base, experience: 'beginner', selected_modes: ['bodybuilding'] })
    expect(beginnerBb.goal).toBe('hypertrophy')
    expect(beginnerBb.intensity).toBe('medium')
  })

  it('mantiene la metodologia scelta nella sessione singola', () => {
    const single = applyAutomaticProgramming({
      ...base, program_kind: 'single_session', training_days: 1,
      selected_modes: ['strength'], strength_method: '3x5', crossfit_format: 'chipper',
    })
    expect(single.strength_method).toBe('3x5')
    expect(single.crossfit_format).toBe('chipper')
  })
})

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
    expect(program.week.map((session) => [session.day, session.mode, session.split])).toEqual([
      ['monday', 'bodybuilding', 'push'],
      ['tuesday', 'bodybuilding', 'pull'],
      ['wednesday', 'bodybuilding', 'legs'],
      ['friday', 'crossfit_hybrid', null],
      ['saturday', 'crossfit_hybrid', null],
    ])
    const hybrids = program.week.filter((session) => session.mode === 'crossfit_hybrid')
    expect(hybrids[0].priority_muscles).toEqual(['lateral_delts', 'biceps', 'triceps'])
    expect(hybrids[1].priority_muscles).toEqual([])
  })

  it('4 giorni PPL usa carenze per il quarto giorno e Total Body senza carenze', () => {
    const specialized = generateWeeklyProgram({ ...base, training_days: 4, selected_modes: ['bodybuilding'], weak_points: ['lateral_delts', 'biceps'] })
    expect(specialized.week.map((session) => session.split)).toContain('upper')
    const balanced = generateWeeklyProgram({ ...base, training_days: 4, selected_modes: ['bodybuilding'], weak_points: [] })
    expect(balanced.week.map((session) => session.split)).toContain('full_body')
  })

  it('4 giorni BB Upper/Lower conserva Upper, Lower, riposo, Upper, Lower', () => {
    const program = generateWeeklyProgram({ ...base, training_days: 4, selected_modes: ['bodybuilding'], split_system: 'upper_lower' })
    expect(program.week.map((session) => [session.day, session.split])).toEqual([
      ['monday', 'upper'], ['tuesday', 'lower'], ['thursday', 'upper'], ['saturday', 'lower'],
    ])
  })

  it('4 giorni Front/Back + CrossFit alterna BB e CrossFit', () => {
    const program = generateWeeklyProgram({ ...base, training_days: 4, selected_modes: ['bodybuilding', 'crossfit'], split_system: 'front_back' })
    expect(program.week.map((session) => [session.day, session.mode, session.split])).toEqual([
      ['monday', 'bodybuilding', 'front_body'],
      ['tuesday', 'crossfit', null],
      ['thursday', 'bodybuilding', 'back_body'],
      ['saturday', 'crossfit', null],
    ])
  })

  it('6 giorni Forza + CrossFit alterna 3+3, riposa giovedì e adatta la fatica', () => {
    const program = generateWeeklyProgram({ ...base, training_days: 6, selected_modes: ['strength', 'crossfit'], strength_method: '5x5' })
    expect(program.week.map((session) => [session.day, session.mode])).toEqual([
      ['monday', 'strength'], ['tuesday', 'crossfit'], ['wednesday', 'strength'],
      ['friday', 'crossfit'], ['saturday', 'strength'], ['sunday', 'crossfit'],
    ])
    const crossfit = program.week.filter((session) => session.mode === 'crossfit')
    expect(crossfit.map((session) => session.label)).toEqual([
      'CrossFit — Upper / Gymnastics', 'CrossFit — Mixed adattato', 'CrossFit — Endurance / Tecnica',
    ])
    expect(crossfit.every((session) => (session.fatigue_avoid_muscles?.length ?? 0) > 0)).toBe(true)
  })

  it('normalizza un programma a minimo due settimane', () => {
    const program = generateWeeklyProgram({ ...base, duration_weeks: 1 })
    expect(program.config.duration_weeks).toBe(2)
    expect(program.persisted).toBe(false)
  })

  it('riassume una settimana solo CrossFit senza avvisi duplicati per ogni coppia', () => {
    const program = generateWeeklyProgram({ ...base, training_days: 5, selected_modes: ['crossfit'] })
    expect(program.warnings).toHaveLength(1)
    expect(program.warnings[0].message).toContain('CrossFit ad alta frequenza')
    expect(new Set(program.week.map((session) => session.metcon_format)).size).toBe(5)
    expect(program.week.every((session) => session.label.includes('—'))).toBe(true)
  })

  it('la sessione singola non crea una split settimanale né richiede due settimane', () => {
    const session = generateWeeklyProgram({ ...base, program_kind: 'single_session', duration_weeks: 1, selected_modes: ['crossfit_hybrid'] })
    expect(session.week).toHaveLength(1)
    expect(session.config.training_days).toBe(1)
    expect(session.config.duration_weeks).toBe(1)
    expect(session.persisted).toBe(false)
  })

  it('la sessione singola BB usa direttamente lo split scelto senza creare giorni', () => {
    const session = generateWeeklyProgram({ ...base, program_kind: 'single_session', selected_modes: ['bodybuilding'], single_session_split: 'bro_chest' })
    expect(session.week).toHaveLength(1)
    expect(session.week[0].split).toBe('bro_chest')
  })

  it('la sessione singola accetta una selezione personalizzata di piu gruppi muscolari', () => {
    const session = generateWeeklyProgram({
      ...base,
      program_kind: 'single_session',
      selected_modes: ['bodybuilding'],
      single_session_target_muscles: ['front_delts', 'lateral_delts', 'biceps', 'triceps', 'quads'],
    })
    expect(session.week).toHaveLength(1)
    expect(session.week[0].priority_muscles).toEqual(['lateral_delts', 'biceps', 'triceps'])
    expect(session.week[0].custom_target_muscles).toEqual(['front_delts', 'lateral_delts', 'biceps', 'triceps', 'quads'])
    expect(session.week[0].label).toContain('Deltoidi')
    expect(session.week[0].label).toContain('Bicipiti')
    // Nessuno split fisso: i gruppi scelti possono attraversare push e pull (es. deltoide
    // posteriore + laterale), quindi non esiste un'unica etichetta di split naturale per loro.
    expect(session.week[0].split).toBeNull()
    expect(session.week[0].recovery_profile).toBeTruthy()
  })

  it('PPL assegna spalle e braccia a Push/Pull, mai a Legs', () => {
    const program = generateWeeklyProgram({ ...base, training_days: 3, selected_modes: ['bodybuilding'], weak_points: ['lateral_delts', 'rear_delts', 'biceps', 'triceps'] })
    const bySplit = new Map(program.week.map((session) => [session.split, session]))
    // Aggiornamento 19/08 pomeriggio (PPL Standard Biomeccanico a 6 Slot, sez. spec utente):
    // bicipiti e tricipiti sono di nuovo nativi sia di Push sia di Pull, di proposito — il
    // nuovo template a 6 slot allena entrambi in entrambe le sedute con angoli complementari
    // (capo lungo/allungamento su Push, capo corto/accorciamento su Pull), quindi una carenza
    // dichiarata è naturalmente compatibile con entrambe fin dall'inizio (non serve più il
    // richiamo incrociato per garantire le 2 esposizioni settimanali per loro). lateral_delts
    // resta nativo solo di Push e rear_delts solo di Pull: qui il richiamo incrociato li
    // aggiunge ancora, in coda, all'altra sessione.
    expect(bySplit.get('push')?.priority_muscles).toEqual(['lateral_delts', 'biceps', 'triceps', 'rear_delts'])
    expect(bySplit.get('pull')?.priority_muscles).toEqual(['rear_delts', 'biceps', 'triceps', 'lateral_delts'])
    expect(bySplit.get('legs')?.priority_muscles).toEqual([])
  })

  it('PPL con carenza bicipiti/tricipiti fa lavorare un capo diverso a Push e Pull', () => {
    const program = generateWeeklyProgram({ ...base, training_days: 3, selected_modes: ['bodybuilding'], weak_points: ['biceps', 'triceps'] })
    const bySplit = new Map(program.week.map((session) => [session.split, session]))
    const push = bySplit.get('push')
    const pull = bySplit.get('pull')
    expect(push?.priority_portions?.biceps).toBeDefined()
    expect(pull?.priority_portions?.biceps).toBeDefined()
    expect(push?.priority_portions?.biceps).not.toBe(pull?.priority_portions?.biceps)
    expect(push?.priority_portions?.triceps).toBeDefined()
    expect(pull?.priority_portions?.triceps).toBeDefined()
    expect(push?.priority_portions?.triceps).not.toBe(pull?.priority_portions?.triceps)
    // Le spalle (lateral_delts) non hanno una rotazione per porzione: la granularità
    // esiste già come Muscle distinti (front/lateral/rear_delts), non serve qui.
    expect(push?.priority_portions?.lateral_delts).toBeUndefined()
  })

  it('una carenza petto in PPL riceve seduta principale e richiamo settimanale', () => {
    const program = generateWeeklyProgram({
      ...base, training_days: 3, selected_modes: ['bodybuilding'], split_system: 'ppl', weak_points: ['chest'],
    })
    const exposures = program.week.filter((session) => session.priority_muscles.includes('chest'))
    expect(exposures.length).toBeGreaterThanOrEqual(2)
    expect(exposures.some((session) => session.split === 'push')).toBe(true)
    expect(exposures.some((session) => session.split !== 'push')).toBe(true)
  })

  it('Upper/Lower ruota laterali e posteriori fra Upper A/B e lascia puliti i Lower', () => {
    const program = generateWeeklyProgram({ ...base, training_days: 4, selected_modes: ['bodybuilding'], split_system: 'upper_lower', weak_points: ['lateral_delts', 'rear_delts', 'biceps', 'triceps'] })
    const uppers = program.week.filter((session) => session.split === 'upper').sort((a, b) => a.variant.localeCompare(b.variant))
    expect(uppers.map((session) => session.priority_muscles)).toEqual([
      ['lateral_delts', 'biceps', 'triceps', 'rear_delts'],
      ['rear_delts', 'biceps', 'triceps', 'lateral_delts'],
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

  it('Tabata si alterna con l’altra disciplina invece di restare confinato a un giorno solo', () => {
    const program = generateWeeklyProgram({ ...base, training_days: 6, selected_modes: ['bodybuilding', 'tabata'] })
    expect(program.week.filter((session) => session.mode === 'tabata')).toHaveLength(3)
    expect(program.week.filter((session) => session.mode === 'bodybuilding')).toHaveLength(3)
    const modes = program.week.map((session) => session.mode)
    for (let i = 1; i < modes.length; i++) expect(modes[i]).not.toBe(modes[i - 1])
  })

  it('5 giorni BB + Tabata produce Push/TB/Pull/TB/Legs', () => {
    const program = generateWeeklyProgram({ ...base, training_days: 5, selected_modes: ['bodybuilding', 'tabata'] })
    expect(program.week.filter((session) => session.mode === 'bodybuilding')).toHaveLength(3)
    expect(program.week.filter((session) => session.mode === 'tabata')).toHaveLength(2)
    expect(program.week.filter((session) => session.mode === 'bodybuilding').map((session) => session.split).sort()).toEqual(['legs', 'pull', 'push'])
    const modes = program.week.map((session) => session.mode)
    for (let i = 1; i < modes.length; i++) expect(modes[i]).not.toBe(modes[i - 1])
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

  it('rifiuta sempre una combinazione di tre discipline', () => {
    expect(() => generateWeeklyProgram({ ...base, training_days: 6, selected_modes: ['bodybuilding', 'strength', 'crossfit'] })).toThrow('al massimo due')
  })
})
