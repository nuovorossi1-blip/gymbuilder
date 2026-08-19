import { describe, expect, it } from 'vitest'
import { generaBodybuilding } from '../bodybuilding'
import { generateWeeklyProgram } from '../../engine/weeklyPlan'
import { PRESET_EQUIPMENT } from '../equipment'
import type { Exercise, Muscle, Split, WeeklyProgramConfig } from '../../types'
import catalogoReale from './fixtures/exercises.json'

const catalogoBase = catalogoReale as unknown as Exercise[]
const isolamentoPettoBase = catalogoBase.find((exercise) => exercise.id === 'croci_cavi')!
// Il remoto curato contiene anche Pec Deck e croci con manubri; la fixture
// storica ne aveva soltanto due e non poteva rappresentare Bro Petto 2+3.
const catalogo = [
  ...catalogoBase,
  { ...isolamentoPettoBase, id: 'pec_deck_test', name: 'Pec deck test', equipment: 'machine' as const },
]

const TUTTI_GLI_SPLIT: Split[] = [
  'push', 'pull', 'legs', 'upper', 'lower', 'full_body',
  'bro_chest', 'bro_back', 'bro_shoulders', 'bro_arms', 'bro_legs',
  'front_body', 'back_body',
]

function mainBlock(w: ReturnType<typeof generaBodybuilding>) {
  return w.blocks.find((b) => b.kind === 'main')!
}

describe('generaBodybuilding — struttura di base (sez. 3, 21 della specifica)', () => {
  it('apre sempre con un compound multiarticolare, anche con carenze', () => {
    for (const split of TUTTI_GLI_SPLIT) {
      const w = generaBodybuilding(catalogo, {
        split, goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
        duration_min: 60, priority_muscles: ['lateral_delts', 'biceps', 'triceps'],
        excluded_exercises: [], seed: 17,
      })
      expect(mainBlock(w).exercises[0]?.role).toBe('compound')
    }
  })

  for (const split of TUTTI_GLI_SPLIT) {
    it(`${split}: produce almeno 6 esercizi principali con palestra completa, 60 minuti`, () => {
      const w = generaBodybuilding(catalogo, {
        split,
        goal: 'hypertrophy',
        experience: 'intermediate',
        equipment: 'full_gym',
        duration_min: 60,
        priority_muscles: [],
        excluded_exercises: [],
        seed: 42,
      })
      const n = mainBlock(w).exercises.length
      expect(n).toBeGreaterThanOrEqual(6)
    })
  }

  it('75 minuti con palestra completa resta al massimo di 6 esercizi', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
      duration_min: 75, priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    expect(mainBlock(w).exercises.length).toBe(6)
  })

  it('sessione Bro Petto usa 2 compound e 3 isolamenti tutti per il petto', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'bro_chest', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
      duration_min: 60, priority_muscles: [], excluded_exercises: [], seed: 21,
    })
    const exercises = mainBlock(w).exercises
    expect(exercises).toHaveLength(6)
    expect(exercises.slice(0, 2).every((exercise) => exercise.role === 'compound' && exercise.muscle === 'chest')).toBe(true)
    expect(exercises.slice(2, 5).every((exercise) => exercise.role === 'isolation' && exercise.muscle === 'chest')).toBe(true)
  })

  it('30 minuti resta a 6 esercizi adattando serie e recuperi, non tagliando sotto il minimo', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'pull', goal: 'hypertrophy', experience: 'beginner', equipment: 'full_gym',
      duration_min: 30, priority_muscles: [], excluded_exercises: [], seed: 7,
    })
    const principale = mainBlock(w)
    expect(principale.exercises.length).toBe(6)
  })

  it('non genera mai esercizi duplicati nel blocco principale', () => {
    for (const split of TUTTI_GLI_SPLIT) {
      const w = generaBodybuilding(catalogo, {
        split, goal: 'mixed', experience: 'advanced', equipment: 'full_gym',
        duration_min: 75, priority_muscles: [], excluded_exercises: [], seed: 99,
      })
      const ids = mainBlock(w).exercises.map((e) => e.exercise_id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe('generaBodybuilding — attrezzatura (sez. 21, 31)', () => {
  it('con solo corpo libero non seleziona mai esercizi che richiedono altro attrezzo', () => {
    for (const split of TUTTI_GLI_SPLIT) {
      const w = generaBodybuilding(catalogo, {
        split, goal: 'hypertrophy', experience: 'advanced', equipment: 'bodyweight',
        duration_min: 60, priority_muscles: [], excluded_exercises: [], seed: 3,
      })
      const perId = new Map(catalogo.map((e) => [e.id, e]))
      for (const es of mainBlock(w).exercises) {
        expect(perId.get(es.exercise_id)?.equipment).toBe('bodyweight')
      }
    }
  })

  it('gli esercizi esclusi non compaiono mai', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
      duration_min: 75, priority_muscles: [], excluded_exercises: ['panca_piana', 'panca_inclinata_bil'],
      seed: 5,
    })
    const ids = mainBlock(w).exercises.map((e) => e.exercise_id)
    expect(ids).not.toContain('panca_piana')
    expect(ids).not.toContain('panca_inclinata_bil')
  })
})

describe('generaBodybuilding — priorità assegnate dalla settimana', () => {
  it('Push standard non contiene dorso, rematori o altri esercizi di tirata', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
      duration_min: 60, priority_muscles: [], excluded_exercises: [], seed: 37,
    })
    const exercises = mainBlock(w).exercises
    const byId = new Map(catalogo.map((exercise) => [exercise.id, exercise]))
    expect(exercises.some((exercise) => exercise.muscle === 'back')).toBe(false)
    expect(exercises.some((exercise) => byId.get(exercise.exercise_id)?.movement_pattern === 'horizontal_pull')).toBe(false)
    expect(exercises.some((exercise) => byId.get(exercise.exercise_id)?.movement_pattern === 'vertical_pull')).toBe(false)
  })

  it('Push ammette il dorso solo come richiamo quando è una carenza esplicita', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
      duration_min: 60, priority_muscles: ['back'], excluded_exercises: [], seed: 37,
    })
    const backExercises = mainBlock(w).exercises.filter((exercise) => exercise.muscle === 'back')
    expect(backExercises).toHaveLength(1)
    expect(backExercises[0]?.note).toBe('richiamo carenza')
  })

  it('con priority_portions assegnata, il richiamo bicipiti sceglie il capo richiesto', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
      duration_min: 60, priority_muscles: ['biceps'], priority_portions: { biceps: 'brachialis' },
      excluded_exercises: [], seed: 37,
    })
    const bicipiti = mainBlock(w).exercises.find((exercise) => exercise.muscle === 'biceps')
    const catalogoById = new Map(catalogo.map((exercise) => [exercise.id, exercise]))
    expect(catalogoById.get(bicipiti!.exercise_id)?.focus_portion).toBe('brachialis')
  })

  it('senza priority_portions (sessione singola), il richiamo bicipiti sceglie il capo lungo di default', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
      duration_min: 60, priority_muscles: ['biceps'],
      excluded_exercises: [], seed: 37,
    })
    const bicipiti = mainBlock(w).exercises.find((exercise) => exercise.muscle === 'biceps')
    const catalogoById = new Map(catalogo.map((exercise) => [exercise.id, exercise]))
    expect(catalogoById.get(bicipiti!.exercise_id)?.focus_portion).toBe('long_head')
  })

  it('Push con 5 carenze spalle/braccia non riduce mai il petto sotto la dotazione standard, e non toglie tricipiti/dip per una 3ª carenza spalle', () => {
    // Comportamento corretto il 19/08 (feedback utente): prima, dichiarare tante carenze in una
    // volta faceva scendere il petto (il muscolo identitario di Push) da 2 a 1 esercizio per
    // fargli spazio — "un solo esercizio per ogni distretto" era il comportamento di allora,
    // esplicitamente sbagliato: lo standard dello split deve restare la base, mai smontato dalle
    // carenze. Ora al massimo 3 carenze ricevono uno slot dedicato per sessione; le altre
    // restano fuori da oggi (la settimana le richiama altrove, weeklyPlan.ts) invece di
    // sacrificare il petto.
    //
    // Aggiornamento 19/08 pomeriggio (PPL Standard Biomeccanico a 6 Slot): Push ha ora SEMPRE
    // 6 slot fissi (niente più 6° slot "extra" libero), quindi front_delts non può più solo
    // aggiungersi: deve sacrificare uno slot esistente. Le spalle (fronte/laterale/post.) non
    // superano comunque mai 2 esercizi in seduta — qui front_delts e lateral_delts occupano i 2
    // slot spalle disponibili, rear_delts (3ª carenza spalle) resta fuori da oggi. Il sacrificio
    // colpisce il tricipiti PIÙ ridondante (il composto/dip: tricipiti compare 2 volte di
    // default, contro l'unica copia di bicipiti) — bicipiti resta protetto per costruzione,
    // esattamente quanto richiesto ("non devi rimuovere bicipiti per fare spazio ai deltoidi").
    const w = generaBodybuilding(catalogo, {
      split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
      duration_min: 60,
      priority_muscles: ['front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps'],
      excluded_exercises: [], seed: 31,
    })
    const main = mainBlock(w).exercises
    expect(main.filter((exercise) => exercise.muscle === 'chest')).toHaveLength(2)
    expect(main.map((exercise) => exercise.muscle)).toEqual([
      'chest', 'chest', 'lateral_delts', 'front_delts', 'biceps', 'triceps',
    ])
    expect(main.find((exercise) => exercise.muscle === 'front_delts')?.note).toBe('carenza')
    expect(main.find((exercise) => exercise.muscle === 'lateral_delts')?.note).toBe('carenza')
    // rear_delts era la 3ª carenza spalle dichiarata: scartata per il tetto di 2 spalle per
    // seduta, non promossa a scapito di un altro muscolo.
    expect(main.some((exercise) => exercise.muscle === 'rear_delts')).toBe(false)
    // Bicipiti/tricipiti restano nella seduta perché fanno già parte della struttura standard
    // di Push (nuovo standard PPL a 6 slot), ma non ricevono il trattamento carenza: le loro
    // carenze dichiarate (4ª e 5ª nell'ordine, oltre il tetto di 3 per sessione) non hanno
    // reclamato slot dedicati.
    expect(main.find((exercise) => exercise.muscle === 'biceps')?.note).toBeUndefined()
    expect(main.find((exercise) => exercise.muscle === 'triceps')?.note).toBeUndefined()
  })

  it('Push con laterali/bicipiti/tricipiti carenti non triplica il petto per fargli spazio', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
      duration_min: 60, priority_muscles: ['lateral_delts', 'biceps', 'triceps'],
      excluded_exercises: [], seed: 11,
    })
    const main = mainBlock(w).exercises
    expect(main.filter((exercise) => exercise.muscle === 'chest').length).toBeLessThanOrEqual(2)
    expect(main.map((exercise) => exercise.muscle)).toEqual(expect.arrayContaining(['lateral_delts', 'biceps', 'triceps']))
    const laterali = main.find((exercise) => exercise.muscle === 'lateral_delts')
    expect(laterali?.note).toBe('carenza')
  })

  it('PPL settimanale reale: 5 carenze spalle/braccia non svuotano petto o dorso in nessuna seduta', () => {
    // Scenario segnalato dall'utente il 19/08: pianificazione PPL con tutti i deltoidi +
    // bicipiti + tricipiti come carenze finiva per riempire Push (o Pull) quasi solo di
    // spalle/braccia, lasciando il petto (o il dorso) a un solo esercizio. Verifica end-to-end
    // (generateWeeklyProgram + generaBodybuilding insieme, non solo il generatore isolato).
    const config: WeeklyProgramConfig = {
      program_kind: 'program', duration_weeks: 4,
      training_days: 3, selected_modes: ['bodybuilding'], goal: 'hypertrophy', split_system: 'ppl',
      experience: 'advanced', duration_min: 60,
      equipment: { preset: 'full_gym', available: PRESET_EQUIPMENT.full_gym },
      weak_points: ['front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps'],
      preferences: { excluded_exercise_ids: [], preferred_exercise_ids: [], bodyweight_policy: 'finisher_only', elastic_policy: 'never' },
      intensity: 'medium', crossfit_format: 'amrap',
      single_session_split: 'push', hybrid_balance: 'bb_dominant',
      tabata: { work_sec: 20, rest_sec: 10, rounds: 8, prescription: 'time' },
    }
    const program = generateWeeklyProgram(config)
    for (const session of program.week) {
      const w = generaBodybuilding(catalogo, {
        split: session.split!, goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
        duration_min: 60, priority_muscles: session.priority_muscles, priority_portions: session.priority_portions,
        excluded_exercises: [], seed: 7,
      })
      const main = mainBlock(w).exercises
      const identitario = session.split === 'push' ? 'chest' : session.split === 'pull' ? 'back' : null
      if (identitario) {
        // Almeno 2 esercizi per il muscolo identitario dello split, come nella struttura
        // standard senza carenze — mai ridotto a 1 per fare spazio alle carenze.
        expect(main.filter((exercise) => exercise.muscle === identitario).length).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('Push 60 minuti riserva gli slot alle carenze prima di raddoppiare il petto', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: ['lateral_delts', 'biceps', 'triceps'], excluded_exercises: [], seed: 7,
    })
    const main = mainBlock(w).exercises
    expect(main).toHaveLength(6)
    expect(main.filter((exercise) => exercise.muscle === 'chest').length).toBeLessThanOrEqual(2)
    expect(main.map((exercise) => exercise.muscle)).toEqual(expect.arrayContaining(['lateral_delts', 'biceps', 'triceps']))
  })
})

describe('generaBodybuilding — scenario critico sez. 28 della correzione', () => {
  it('Push PPL avanzato resta Push: nessun thruster/squat e richiama bicipiti + tricipiti', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
      duration_min: 60, priority_muscles: ['lateral_delts', 'rear_delts', 'biceps', 'triceps'],
      excluded_exercises: [], seed: 42,
    })
    const main = mainBlock(w)
    const byId = new Map(catalogo.map((exercise) => [exercise.id, exercise]))
    expect(main.exercises.length).toBeGreaterThanOrEqual(5)
    expect(main.exercises.length).toBeLessThanOrEqual(6)
    expect(main.exercises.map((exercise) => exercise.muscle)).toContain('biceps')
    expect(main.exercises.map((exercise) => exercise.muscle)).toContain('triceps')
    expect(main.exercises.every((exercise) => byId.get(exercise.exercise_id)?.movement_pattern !== 'squat')).toBe(true)
    expect(main.exercises.some((exercise) => exercise.exercise_id.includes('thruster'))).toBe(false)
  })

  it('Pull PPL mantiene tre esercizi dorso + rear delts + bicipiti + richiamo tricipiti', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'pull', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: ['rear_delts', 'biceps', 'triceps'], excluded_exercises: [], seed: 9,
    })
    const muscles = mainBlock(w).exercises.map((exercise) => exercise.muscle)
    expect(muscles.filter((muscle) => muscle === 'back')).toHaveLength(3)
    expect(muscles).toContain('rear_delts'); expect(muscles).toContain('biceps'); expect(muscles).toContain('triceps')
  })

  it('Pull con tutte e cinque le carenze di spalle/braccia non perde mai il dorso', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'pull', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: ['front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps'],
      excluded_exercises: [], seed: 14,
    })
    const muscles = mainBlock(w).exercises.map((exercise) => exercise.muscle)
    expect(muscles.filter((muscle) => muscle === 'back').length).toBeGreaterThanOrEqual(1)
  })

  it('Legs senza carenze esterne mantiene quad compound, posterior chain, isolamenti, polpacci e glutei (sez. feedback utente 19/08)', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'legs', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 5,
    })
    const main = mainBlock(w).exercises
    // PPL Standard Biomeccanico a 6 Slot (sez. spec utente 19/08 pomeriggio): 2 composti
    // ENTRAMBI quad-dominanti (squat + leg press/hack, niente più composto femorali fisso),
    // isolamento quad, isolamento femorali, glutei (hip thrust/stacco rumeno, in chiusura della
    // catena posteriore) e polpacci a chiudere. Adduttori non più di default.
    expect(main.map((exercise) => exercise.muscle)).toEqual(['quads', 'quads', 'quads', 'hamstrings', 'glutes', 'calves'])
    // Glutei (hip thrust/stacco rumeno) è un composto nel catalogo, non un isolamento: la
    // spec lo chiama "ISOLATION_GLUTES_THRUST" solo per il ruolo anatomico, non per il tag
    // compound/isolation reale dell'esercizio.
    expect(main.map((exercise) => exercise.role)).toEqual(['compound', 'compound', 'isolation', 'isolation', 'compound', 'isolation'])
  })

  it('Pull standard: 3 composti dorso ad angoli diversi, poi rear delt, tricipiti e bicipiti (sez. spec utente 19/08 pomeriggio)', () => {
    // Prima del PPL Standard a 6 Slot, il 6° slot di Pull era avambracci (EXTRA_SLOTS): ora il
    // template ha già 6 slot fissi (3 composti dorso + rear delt + tricipiti + bicipiti, sez.
    // spec utente), niente più spazio libero per avambracci di default.
    const w = generaBodybuilding(catalogo, {
      split: 'pull', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym', duration_min: 75,
      priority_muscles: [], excluded_exercises: [], seed: 18,
    })
    const main = mainBlock(w).exercises
    expect(main.filter((exercise) => exercise.muscle === 'back' && exercise.role === 'compound')).toHaveLength(3)
    expect(main.map((exercise) => exercise.muscle)).toEqual(['back', 'back', 'back', 'rear_delts', 'triceps', 'biceps'])
    // Angoli complementari a Push (capo lungo/allungamento): qui capo laterale/mediale
    // (tricipiti, pushdown) e capo breve/accorciamento (bicipiti, preacher/spider).
    const catalogoById = new Map(catalogo.map((exercise) => [exercise.id, exercise]))
    const triceps = main.find((exercise) => exercise.muscle === 'triceps')!
    const biceps = main.find((exercise) => exercise.muscle === 'biceps')!
    expect(catalogoById.get(triceps.exercise_id)?.focus_portion).toBe('lateral_head')
    expect(catalogoById.get(biceps.exercise_id)?.focus_portion).toBe('short_head')
  })

  it('sposta sempre uno o due esercizi addome nel riscaldamento e non nel blocco principale', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'legs', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 22,
    })
    const warmupCore = w.blocks.find((block) => block.kind === 'warmup')!.exercises.filter((exercise) => exercise.muscle === 'core')
    expect(warmupCore.length).toBeGreaterThanOrEqual(1)
    expect(warmupCore.length).toBeLessThanOrEqual(2)
    expect(mainBlock(w).exercises.some((exercise) => exercise.muscle === 'core')).toBe(false)
  })

  it('Legs inizia sempre con uno squat/pressa stabile, mai con un affondo unilaterale', () => {
    const perId = new Map(catalogo.map((exercise) => [exercise.id, exercise]))
    for (let seed = 1; seed <= 30; seed++) {
      const w = generaBodybuilding(catalogo, {
        split: 'legs', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym', duration_min: 60,
        priority_muscles: [], excluded_exercises: [], seed,
      })
      const first = mainBlock(w).exercises[0]
      expect(first.role).toBe('compound')
      expect(first.muscle).toBe('quads')
      expect(perId.get(first.exercise_id)?.movement_pattern).toBe('squat')
      expect(first.exercise_id).not.toBe('bulgarian_split')
    }
  })

  it('Push: due press petto, poi alzate laterali — mai uno shoulder press pesante come 3° (sez. feedback utente 19/08)', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym', duration_min: 75,
      priority_muscles: ['biceps'], excluded_exercises: [], seed: 12,
    })
    const main = mainBlock(w).exercises
    // Dopo 2 panche i deltoidi anteriori sono già affaticati come secondari: un altro composto
    // pesante dedicato lì era ridondante e controproducente ("shoulder press come 3° esercizio
    // non serve, non è utile ed è controproducente"). Il 3° slot è ora alzate laterali
    // (isolamento), il 4° un composto tricipiti che allena anche petto e deltoide anteriore
    // (dip), non più uno shoulder press fisso.
    expect(main.slice(0, 4).map((exercise) => [exercise.muscle, exercise.role])).toEqual([
      ['chest', 'compound'], ['chest', 'compound'], ['lateral_delts', 'isolation'], ['triceps', 'compound'],
    ])
    // Il tricipiti composto (dip, 4° slot) fa parte della struttura standard di Push — viene
    // prima dei bicipiti (richiamo incrociato) per costruzione, non è un caso da testare qui.
    // Ciò che conta è che la carenza bicipiti resti comunque davanti al tricipiti ISOLAMENTO
    // (l'accessorio finale, non lo slot strutturale), come da priorità "richiami prima degli
    // accessori extra".
    expect(main.findIndex((exercise) => exercise.muscle === 'biceps'))
      .toBeLessThan(main.findIndex((exercise) => exercise.muscle === 'triceps' && exercise.role === 'isolation'))
  })

  it('Pull avanzato con carenze braccia/deltoidi e preferiti resta un Pull coerente, non un accorpamento di tutti i muscoli carenti', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'pull',
      goal: 'hypertrophy',
      experience: 'advanced',
      equipment: 'full_gym',
      duration_min: 75,
      priority_muscles: ['biceps', 'triceps', 'rear_delts'],
      excluded_exercises: [],
      preferred_exercises: ['curl_cavo', 'pushdown', 'reverse_pec_deck'],
      weekly_volume: { // volume già scarso per triceps/rear_delts, biceps già coperto altrove questa settimana
        chest: 12, back: 4, front_delts: 8, lateral_delts: 8, rear_delts: 2,
        biceps: 12, triceps: 2, forearms: 4, quads: 10, hamstrings: 10, glutes: 8, adductors: 4, calves: 6, core: 6,
      },
      seed: 28,
    })

    const principale = mainBlock(w)
    const muscoli = principale.exercises.map((e) => e.muscle)

    // Resta un Pull: niente petto, niente quadricipiti/femorali.
    expect(muscoli).not.toContain('chest')
    expect(muscoli).not.toContain('quads')
    expect(muscoli).not.toContain('hamstrings')

    // Il dorso resta il target dominante (sez. 11: "3 Dorso").
    expect(muscoli.filter((m) => m === 'back').length).toBeGreaterThanOrEqual(3)
    expect(muscoli).toContain('rear_delts')
    expect(muscoli).toContain('biceps')

    // Il volume di biceps è già a posto questa settimana (12/10 target): non deve
    // ricevere un richiamo aggiuntivo oltre allo slot naturale del Pull.
    const richiami = principale.exercises.filter((e) => e.note === 'richiamo')
    expect(richiami.every((e) => e.muscle !== 'biceps')).toBe(true)

    // Il numero di esercizi resta nei limiti, non esplode per inseguire ogni carenza.
    expect(principale.exercises.length).toBeGreaterThanOrEqual(5)
    expect(principale.exercises.length).toBeLessThanOrEqual(6)
  })

  it('sessione custom spalle e braccia non inserisce compound petto se il petto non e selezionato', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'full_body',
      goal: 'hypertrophy',
      experience: 'intermediate',
      equipment: 'full_gym',
      duration_min: 60,
      target_muscles: ['front_delts', 'lateral_delts', 'biceps', 'triceps'],
      priority_muscles: ['lateral_delts', 'triceps'],
      excluded_exercises: [],
      seed: 18,
    })
    const perId = new Map(catalogo.map((exercise) => [exercise.id, exercise]))
    const main = mainBlock(w).exercises

    expect(main.length).toBeLessThanOrEqual(6)
    expect(main.map((exercise) => exercise.muscle)).toEqual(expect.arrayContaining(['lateral_delts', 'biceps', 'triceps']))
    expect(main.every((exercise) => {
      const original = perId.get(exercise.exercise_id)
      return !original?.primary_muscles.includes('chest')
    })).toBe(true)
  })

  it('sessione custom con tre gruppi mantiene 6 esercizi e non perde i bicipiti', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'full_body',
      goal: 'hypertrophy',
      experience: 'intermediate',
      equipment: 'full_gym',
      duration_min: 60,
      target_muscles: ['front_delts', 'triceps', 'biceps'],
      priority_muscles: ['triceps'],
      excluded_exercises: [],
      seed: 25,
    })

    const main = mainBlock(w).exercises
    expect(main.length).toBeGreaterThanOrEqual(5)
    expect(main.length).toBeLessThanOrEqual(6)
    expect(main.map((exercise) => exercise.muscle)).toEqual(expect.arrayContaining(['front_delts', 'triceps', 'biceps']))
    expect(main[0].muscle).toBe('front_delts')
  })

  it('petto + tre deltoidi + braccia mantiene sei slot distinti e dà priorità alle carenze', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'full_body',
      goal: 'hypertrophy',
      experience: 'advanced',
      equipment: 'full_gym',
      duration_min: 60,
      target_muscles: ['chest', 'front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps'],
      priority_muscles: ['front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps'],
      excluded_exercises: [],
      seed: 33,
    })

    const muscles = mainBlock(w).exercises.map((exercise) => exercise.muscle)
    expect(mainBlock(w).exercises).toHaveLength(6)
    expect(muscles).toEqual(['chest', 'front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps'])
    expect(mainBlock(w).exercises.map((exercise) => exercise.role)).toEqual([
      'compound', 'compound', 'isolation', 'isolation', 'isolation', 'isolation',
    ])
  })
})

describe('generaBodybuilding — Push senza shoulder press fisso, dip come esercizio a più muscoli (sez. feedback utente 19/08)', () => {
  it('il dip (dip_parallele/dip_panca) è raggiungibile come slot tricipiti composto: prima escluso da un pattern troppo stretto', () => {
    // dip_parallele ha movement_pattern 'horizontal_push' (petto/deltoide anteriore secondari,
    // esattamente l'esercizio "a più muscoli" descritto dall'utente), ma PATTERN_PER_MUSCOLO.
    // triceps accettava solo 'elbow_extension': l'esercizio non poteva mai essere scelto, per
    // nessuno slot. Su tanti seed diversi il motore deve pescarlo almeno qualche volta.
    const scelti = new Set<string>()
    for (let seed = 1; seed <= 40; seed++) {
      const w = generaBodybuilding(catalogo, {
        split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
        duration_min: 75, priority_muscles: [], excluded_exercises: [], seed,
      })
      const dip = mainBlock(w).exercises.find((exercise) => exercise.muscle === 'triceps' && exercise.role === 'compound')
      if (dip) scelti.add(dip.exercise_id)
    }
    expect(scelti.has('dip_parallele')).toBe(true)
  })

  it('nessuna seduta Push standard genera più uno shoulder press pesante fisso in terza posizione', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = generaBodybuilding(catalogo, {
        split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
        duration_min: 75, priority_muscles: [], excluded_exercises: [], seed,
      })
      const main = mainBlock(w).exercises
      expect(main[2].muscle).toBe('lateral_delts')
      expect(main.filter((exercise) => exercise.muscle === 'front_delts')).toHaveLength(0)
    }
  })
})

describe('generaBodybuilding — PPL Standard Biomeccanico a 6 Slot (sez. spec utente 19/08 pomeriggio)', () => {
  it('Push standard allena anche bicipiti e tricipiti, capo lungo/allungamento — angolo complementare a Pull', () => {
    const catalogoById = new Map(catalogo.map((exercise) => [exercise.id, exercise]))
    const w = generaBodybuilding(catalogo, {
      split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
      duration_min: 75, priority_muscles: [], excluded_exercises: [], seed: 7,
    })
    const main = mainBlock(w).exercises
    expect(main).toHaveLength(6)
    const biceps = main.find((exercise) => exercise.muscle === 'biceps')!
    const triceps = main.find((exercise) => exercise.muscle === 'triceps' && exercise.role === 'isolation')!
    expect(catalogoById.get(biceps.exercise_id)?.focus_portion).toBe('long_head')
    expect(catalogoById.get(triceps.exercise_id)?.focus_portion).toBe('long_head')
  })

  it('Push/Pull/Legs non superano mai 6 esercizi, anche con carenze dichiarate al massimo (3, sez. limite già in vigore)', () => {
    const scenari: Array<{ split: Split; priority: Muscle[] }> = [
      { split: 'push', priority: ['front_delts', 'rear_delts', 'lateral_delts'] },
      { split: 'pull', priority: ['front_delts', 'lateral_delts', 'triceps'] },
      { split: 'legs', priority: ['adductors', 'calves', 'glutes'] },
    ]
    for (const { split, priority } of scenari) {
      for (let seed = 1; seed <= 10; seed++) {
        const w = generaBodybuilding(catalogo, {
          split, goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
          duration_min: 75, priority_muscles: priority, excluded_exercises: [], seed,
        })
        expect(mainBlock(w).exercises.length).toBeLessThanOrEqual(6)
      }
    }
  })
})

describe('generaBodybuilding — esercizi preferiti (sez. 10, 33)', () => {
  it('un esercizio preferito compatibile viene scelto più spesso del suo equivalente non preferito', () => {
    let conPreferito = 0
    const ripetizioni = 30
    for (let seed = 1; seed <= ripetizioni; seed++) {
      const w = generaBodybuilding(catalogo, {
        split: 'push', goal: 'hypertrophy', experience: 'intermediate', equipment: 'full_gym',
        duration_min: 60, priority_muscles: [], excluded_exercises: [],
        preferred_exercises: ['alzate_laterali'], seed,
      })
      const ids = mainBlock(w).exercises.map((e) => e.exercise_id)
      if (ids.includes('alzate_laterali')) conPreferito++
    }
    // Con un solo preferito compatibile per il ruolo "deltoidi laterali", il
    // motore deve sceglierlo praticamente sempre ("evitare di ignorarli
    // senza motivo", sez. 10) — non trattarlo come un candidato fra tanti.
    expect(conPreferito).toBeGreaterThan(ripetizioni * 0.9)
  })
})

describe('generaBodybuilding — compound pesanti limitati (sez. 24, 77)', () => {
  it('non più di due esercizi al massimo livello di fatica sistemica per sessione', () => {
    for (const split of TUTTI_GLI_SPLIT) {
      const w = generaBodybuilding(catalogo, {
        split, goal: 'strength', experience: 'advanced', equipment: 'full_gym',
        duration_min: 90, priority_muscles: [], excluded_exercises: [], seed: 21,
      })
      const perId = new Map(catalogo.map((e) => [e.id, e]))
      const pesanti = mainBlock(w).exercises.filter(
        (e) => (perId.get(e.exercise_id)?.systemic_fatigue ?? 0) >= 3
      )
      expect(pesanti.length).toBeLessThanOrEqual(2)
    }
  })
})

describe('generaBodybuilding — riscaldamento contestuale (sez. 5)', () => {
  it('il riscaldamento di legs non è identico a quello di push', () => {
    const legs = generaBodybuilding(catalogo, {
      split: 'legs', goal: 'hypertrophy', experience: 'intermediate', equipment: 'full_gym',
      duration_min: 60, priority_muscles: [], excluded_exercises: [], seed: 4,
    })
    const push = generaBodybuilding(catalogo, {
      split: 'push', goal: 'hypertrophy', experience: 'intermediate', equipment: 'full_gym',
      duration_min: 60, priority_muscles: [], excluded_exercises: [], seed: 4,
    })
    const idsLegs = legs.blocks.find((b) => b.kind === 'warmup')!.exercises.map((e) => e.exercise_id)
    const idsPush = push.blocks.find((b) => b.kind === 'warmup')!.exercises.map((e) => e.exercise_id)
    expect(idsLegs).not.toEqual(idsPush)
  })
})

describe('generaBodybuilding — protocollo FST-7 (Hany Rambod)', () => {
  it('produce esattamente 3 esercizi base + 1 finisher da 7 serie, in coda di default', () => {
    for (const split of TUTTI_GLI_SPLIT) {
      const w = generaBodybuilding(catalogo, {
        split, goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
        duration_min: 60, priority_muscles: [], excluded_exercises: [], seed: 7, protocol: 'fst7',
      })
      const exercises = mainBlock(w).exercises
      expect(exercises).toHaveLength(4)
      expect(exercises.slice(0, 3).every((e) => e.note !== 'fst7_finisher')).toBe(true)
      const finisher = exercises[3]
      expect(finisher.note).toBe('fst7_finisher')
      expect(finisher.sets).toBe(7)
      expect(finisher.reps).toBe('10-12')
      expect(finisher.rest_sec).toBe(30)
    }
  })

  it('il finisher è sempre cavo, macchina o isolamento — mai un bilanciere pesante', () => {
    const byId = new Map(catalogo.map((e) => [e.id, e]))
    for (const split of TUTTI_GLI_SPLIT) {
      const w = generaBodybuilding(catalogo, {
        split, goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
        duration_min: 60, priority_muscles: [], excluded_exercises: [], seed: 3, protocol: 'fst7',
      })
      const finisher = mainBlock(w).exercises.find((e) => e.note === 'fst7_finisher')
      if (!finisher) continue // attrezzatura/catalogo possono non offrire un candidato per ogni split
      const exercise = byId.get(finisher.exercise_id)!
      expect(exercise.equipment === 'cable' || exercise.equipment === 'machine' || exercise.roles.includes('isolation')).toBe(true)
    }
  })

  it('fst7_preloading sposta il finisher in testa alla sessione', () => {
    const w = generaBodybuilding(catalogo, {
      split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
      duration_min: 60, priority_muscles: [], excluded_exercises: [], seed: 7,
      protocol: 'fst7', fst7_preloading: true,
    })
    expect(mainBlock(w).exercises[0]?.note).toBe('fst7_finisher')
  })
})

describe('generaBodybuilding — protocollo Top Set & Back-Off (stile CBum)', () => {
  it('ogni esercizio diventa un gruppo di 4 serie: 2x Avvicinamento a carico crescente + Top Set (1x6-8 @ RIR0) + Back-Off (1x10-12)', () => {
    // sez. feedback utente 19/08 ("devi dire avvicinamento"): il vero protocollo CBum precede
    // sempre la serie a cedimento con serie di riscaldamento specifico a carico crescente.
    const w = generaBodybuilding(catalogo, {
      split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
      duration_min: 90, priority_muscles: [], excluded_exercises: [], seed: 7,
      protocol: 'cbum_top_backoff',
    })
    const exercises = mainBlock(w).exercises
    expect(exercises.length % 4).toBe(0)
    expect(exercises.length).toBeGreaterThanOrEqual(16) // 4-5 esercizi -> 16-20 voci
    for (let i = 0; i < exercises.length; i += 4) {
      const [avvicinamento1, avvicinamento2, topSet, backOff] = exercises.slice(i, i + 4)
      expect(avvicinamento1.exercise_id).toBe(topSet.exercise_id)
      expect(avvicinamento2.exercise_id).toBe(topSet.exercise_id)
      expect(backOff.exercise_id).toBe(topSet.exercise_id)
      expect(avvicinamento1.note).toBe('avvicinamento')
      expect(avvicinamento1.sets).toBe(1)
      expect(avvicinamento1.reps).toBe('12-15')
      expect(avvicinamento2.note).toBe('avvicinamento')
      expect(avvicinamento2.sets).toBe(1)
      expect(avvicinamento2.reps).toBe('8-10')
      expect(topSet.note).toBe('top_set')
      expect(topSet.sets).toBe(1)
      expect(topSet.reps).toBe('6-8')
      expect(backOff.note).toBe('back_off')
      expect(backOff.sets).toBe(1)
      expect(backOff.reps).toBe('10-12')
    }
  })
})
