import { describe, expect, it } from 'vitest'
import { generaDensity369 } from '../density369'
import type { DensitySplit } from '../density369'
import type { Exercise } from '../../types'
import catalogoReale from './fixtures/exercises.json'

// La fixture storica manca di 14 esercizi presenti nel catalogo vero di Supabase (verificato
// il 21/08) che il protocollo Density 3-6-9 usa. Stesso schema già in uso in
// bodybuilding.test.ts per pec_deck_test: si estende qui, non si tocca la fixture condivisa.
const ESERCIZI_MANCANTI_FIXTURE: Exercise[] = [
  { id: 'chest_press_convergente', name: 'Chest press convergente', primary_muscles: ['chest'], secondary_muscles: ['triceps', 'front_delts'], equipment: 'machine', movement_pattern: 'horizontal_push', systemic_fatigue: 2, technical_complexity: 1, min_experience: 'beginner', default_sets: 3, default_reps: '8-12' } as unknown as Exercise,
  { id: 'pec_deck', name: 'Pec deck', primary_muscles: ['chest'], secondary_muscles: [], equipment: 'machine', movement_pattern: 'chest_fly', systemic_fatigue: 1, technical_complexity: 1, min_experience: 'beginner', default_sets: 3, default_reps: '10-15' } as unknown as Exercise,
  { id: 'alzate_laterali_macchina', name: 'Alzate laterali alla macchina', primary_muscles: ['lateral_delts'], secondary_muscles: [], equipment: 'machine', movement_pattern: 'lateral_raise', systemic_fatigue: 1, technical_complexity: 1, min_experience: 'beginner', default_sets: 3, default_reps: '12-15' } as unknown as Exercise,
  { id: 'leg_extension_unilaterale', name: 'Leg extension unilaterale', primary_muscles: ['quads'], secondary_muscles: [], equipment: 'machine', movement_pattern: 'knee_extension', systemic_fatigue: 1, technical_complexity: 1, min_experience: 'beginner', default_sets: 3, default_reps: '10-15' } as unknown as Exercise,
  { id: 'single_leg_rdl', name: 'Stacco rumeno a una gamba', primary_muscles: ['hamstrings'], secondary_muscles: ['glutes', 'core'], equipment: 'dumbbell', movement_pattern: 'hinge', systemic_fatigue: 2, technical_complexity: 2, min_experience: 'intermediate', default_sets: 3, default_reps: '8-12' } as unknown as Exercise,
  { id: 'good_morning_bil', name: 'Good morning con bilanciere', primary_muscles: ['hamstrings'], secondary_muscles: ['glutes', 'back'], equipment: 'barbell', movement_pattern: 'hinge', systemic_fatigue: 3, technical_complexity: 3, min_experience: 'advanced', default_sets: 3, default_reps: '8-10' } as unknown as Exercise,
  { id: 'leg_curl_seduto', name: 'Leg curl da seduto', primary_muscles: ['hamstrings'], secondary_muscles: [], equipment: 'machine', movement_pattern: 'knee_flexion', systemic_fatigue: 1, technical_complexity: 1, min_experience: 'beginner', default_sets: 3, default_reps: '10-15' } as unknown as Exercise,
  { id: 'calf_leg_press', name: 'Calf raise alla pressa', primary_muscles: ['calves'], secondary_muscles: [], equipment: 'machine', movement_pattern: 'calf_raise', systemic_fatigue: 1, technical_complexity: 1, min_experience: 'beginner', default_sets: 3, default_reps: '12-20' } as unknown as Exercise,
  { id: 'pullup_assisted', name: 'Trazioni assistite', primary_muscles: ['back'], secondary_muscles: ['biceps', 'rear_delts'], equipment: 'bodyweight', movement_pattern: 'vertical_pull', systemic_fatigue: 2, technical_complexity: 1, min_experience: 'beginner', default_sets: 3, default_reps: '8-12' } as unknown as Exercise,
  { id: 'lat_machine_neutra', name: 'Lat machine a presa neutra', primary_muscles: ['back'], secondary_muscles: ['biceps'], equipment: 'machine', movement_pattern: 'vertical_pull', systemic_fatigue: 2, technical_complexity: 1, min_experience: 'beginner', default_sets: 3, default_reps: '8-12' } as unknown as Exercise,
  { id: 'pulldown_unilaterale', name: 'Lat pulldown a un braccio', primary_muscles: ['back'], secondary_muscles: ['biceps'], equipment: 'cable', movement_pattern: 'vertical_pull', systemic_fatigue: 1, technical_complexity: 1, min_experience: 'beginner', default_sets: 3, default_reps: '10-15' } as unknown as Exercise,
  { id: 'chest_to_bar', name: 'Trazioni petto alla sbarra', primary_muscles: ['back'], secondary_muscles: ['biceps', 'rear_delts'], equipment: 'bodyweight', movement_pattern: 'vertical_pull', systemic_fatigue: 3, technical_complexity: 3, min_experience: 'advanced', default_sets: 3, default_reps: '3-6' } as unknown as Exercise,
  { id: 't_bar_row', name: 'T-Bar Row', primary_muscles: ['back'], secondary_muscles: ['biceps', 'rear_delts'], equipment: 'barbell', movement_pattern: 'horizontal_pull', systemic_fatigue: 3, technical_complexity: 2, min_experience: 'intermediate', default_sets: 3, default_reps: '6-10' } as unknown as Exercise,
  { id: 'panca_piana_man', name: 'Panca piana con manubri', primary_muscles: ['chest'], secondary_muscles: ['triceps', 'front_delts'], equipment: 'dumbbell', movement_pattern: 'horizontal_push', systemic_fatigue: 3, technical_complexity: 2, min_experience: 'intermediate', default_sets: 4, default_reps: '6-8' } as unknown as Exercise,
]

const catalogo = [...(catalogoReale as unknown as Exercise[]), ...ESERCIZI_MANCANTI_FIXTURE]

const SPLIT_PPL: DensitySplit[] = ['push', 'pull', 'legs']
const TUTTI_GLI_SPLIT_SUPPORTATI: DensitySplit[] = [
  'push', 'pull', 'legs', 'upper', 'lower', 'bro_chest', 'bro_back', 'bro_arms', 'bro_legs', 'front_body', 'back_body',
]

describe('generaDensity369 — struttura di base', () => {
  for (const split of SPLIT_PPL) {
    it(`${split}: produce sempre 2 blocchi (A, B) di 3 stazioni ciascuno`, () => {
      const w = generaDensity369(catalogo, { split, equipment: 'full_gym', excluded_exercises: [] })
      expect(w).not.toBeNull()
      expect(w!.blocks).toHaveLength(2)
      expect(w!.blocks[0].label).toBe('A')
      expect(w!.blocks[1].label).toBe('B')
      expect(w!.blocks[0].stations).toHaveLength(3)
      expect(w!.blocks[1].stations).toHaveLength(3)
    })

    it(`${split}: ogni stazione rispetta il range di ripetizioni fisso della specifica`, () => {
      const w = generaDensity369(catalogo, { split, equipment: 'full_gym', excluded_exercises: [] })
      for (const blocco of w!.blocks) {
        expect(blocco.stations[0].reps).toBe('3-6')
        expect(blocco.stations[1].reps).toBe('6-12')
        expect(blocco.stations[2].reps).toBe('9-25')
      }
    })

    it(`${split}: nessun esercizio ripetuto fra le 6 stazioni della sessione`, () => {
      const w = generaDensity369(catalogo, { split, equipment: 'full_gym', excluded_exercises: [] })
      const tuttiGliId = w!.blocks.flatMap((b) => b.stations.map((s) => s.exercise_id))
      expect(new Set(tuttiGliId).size).toBe(tuttiGliId.length)
    })
  }

  it('default: 3 giri per blocco, recupero 180s fine giro Blocco A, 120s Blocco B, 210s fra i blocchi', () => {
    const w = generaDensity369(catalogo, { split: 'push', equipment: 'full_gym', excluded_exercises: [] })
    expect(w!.blocks[0].rounds).toBe(3)
    expect(w!.blocks[1].rounds).toBe(3)
    expect(w!.blocks[0].round_rest_sec).toBe(180)
    expect(w!.blocks[1].round_rest_sec).toBe(120)
    expect(w!.block_transition_rest_sec).toBe(210)
  })

  it('rounds_a è configurabile ma con tetto a 4 (specifica: "default 3 round, max 4")', () => {
    const w1 = generaDensity369(catalogo, { split: 'push', equipment: 'full_gym', excluded_exercises: [], rounds_a: 6 })
    expect(w1!.blocks[0].rounds).toBe(4)
    const w2 = generaDensity369(catalogo, { split: 'push', equipment: 'full_gym', excluded_exercises: [], rounds_a: 2 })
    expect(w2!.blocks[0].rounds).toBe(2)
  })

  it('nessuna pausa fra le stazioni dello stesso giro: il tipo dati non ha più un campo di recupero per stazione (corretto 21/08)', () => {
    const w = generaDensity369(catalogo, { split: 'legs', equipment: 'full_gym', excluded_exercises: [] })
    for (const blocco of w!.blocks) {
      for (const stazione of blocco.stations) {
        expect(stazione).not.toHaveProperty('rest_after_sec')
      }
    }
  })
})

describe('generaDensity369 — scelta DETERMINISTICA, non casuale (corretto 21/08 su segnalazione di Rossi)', () => {
  it('lo stesso split, chiamato più volte con la stessa configurazione, dà sempre esattamente gli stessi esercizi', () => {
    const risultati = Array.from({ length: 10 }, () =>
      generaDensity369(catalogo, { split: 'push', equipment: 'full_gym', excluded_exercises: [] })
    )
    for (const w of risultati) expect(w).toEqual(risultati[0])
  })

  for (const split of TUTTI_GLI_SPLIT_SUPPORTATI) {
    it(`${split}: 10 generazioni di fila producono tutte lo stesso identico workout`, () => {
      const risultati = Array.from({ length: 10 }, () =>
        generaDensity369(catalogo, { split, equipment: 'full_gym', excluded_exercises: [] })
      )
      for (const w of risultati) expect(w).toEqual(risultati[0])
    })
  }

  it('Push Blocco A Stazione 1 è di default Panca Piana con Bilanciere (l\'esercizio della specifica, non uno a caso fra le alternative)', () => {
    const w = generaDensity369(catalogo, { split: 'push', equipment: 'full_gym', excluded_exercises: [] })
    expect(w!.blocks[0].stations[0].exercise_id).toBe('panca_piana')
  })

  it('un preferito dell\'utente fra i candidati compatibili vince sul default', () => {
    const w = generaDensity369(catalogo, {
      split: 'push', equipment: 'full_gym', excluded_exercises: [],
      preferred_exercises: ['chest_press_convergente'],
    })
    expect(w!.blocks[0].stations[0].exercise_id).toBe('chest_press_convergente')
  })

  it('escludendo il default di una stazione, subentra deterministicamente il successivo del pool (non un altro a caso)', () => {
    const w1 = generaDensity369(catalogo, { split: 'push', equipment: 'full_gym', excluded_exercises: [] })
    expect(w1!.blocks[0].stations[0].exercise_id).toBe('panca_piana')
    const w2 = generaDensity369(catalogo, { split: 'push', equipment: 'full_gym', excluded_exercises: ['panca_piana'] })
    expect(w2!.blocks[0].stations[0].exercise_id).toBe('panca_piana_man')
    // Ripetuto: stesso risultato ogni volta, non un'alternativa diversa a ogni chiamata.
    const w3 = generaDensity369(catalogo, { split: 'push', equipment: 'full_gym', excluded_exercises: ['panca_piana'] })
    expect(w3!.blocks[0].stations[0].exercise_id).toBe('panca_piana_man')
  })
})

describe('generaDensity369 — alternative per la sostituzione manuale', () => {
  it('ogni stazione con più di un candidato compatibile espone le alternative (per il tasto "Sostituisci")', () => {
    const w = generaDensity369(catalogo, { split: 'push', equipment: 'full_gym', excluded_exercises: [] })
    const st1PettoA = w!.blocks[0].stations[0] // panca_piana di default, 3 candidati totali nel pool
    expect(st1PettoA.exercise_id).toBe('panca_piana')
    expect(st1PettoA.alternatives.map((a) => a.exercise_id)).toEqual(
      expect.arrayContaining(['panca_piana_man', 'chest_press_convergente'])
    )
    expect(st1PettoA.alternatives.some((a) => a.exercise_id === st1PettoA.exercise_id)).toBe(false)
  })

  it('una stazione con un solo candidato compatibile ha alternative vuote, non un errore', () => {
    const w = generaDensity369(catalogo, { split: 'push', equipment: 'full_gym', excluded_exercises: [] })
    const st1SpalleB = w!.blocks[1].stations[1] // military_press-family, un solo candidato nel pool spalle[2]
    expect(st1SpalleB.alternatives).toEqual([])
  })
})

describe('generaDensity369 — regole "salva-effort" (Rossi, 21/08)', () => {
  for (const split of TUTTI_GLI_SPLIT_SUPPORTATI) {
    it(`${split}: la Stazione 1 non è mai un cavo, la Stazione 3 non è mai un bilanciere pesante`, () => {
      const w = generaDensity369(catalogo, { split, equipment: 'full_gym', excluded_exercises: [] })
      for (const blocco of w!.blocks) {
        const st1 = catalogo.find((e) => e.id === blocco.stations[0].exercise_id)!
        const st3 = catalogo.find((e) => e.id === blocco.stations[2].exercise_id)!
        expect(st1.equipment).not.toBe('cable')
        expect(st3.equipment).not.toBe('barbell')
      }
    })
  }
})

describe('generaDensity369 — attrezzatura ed esclusioni', () => {
  it('rispetta le esclusioni: escludendo tutte le opzioni Stazione 1 di Legs ritorna null, non un errore', () => {
    const w = generaDensity369(catalogo, {
      split: 'legs', equipment: 'full_gym',
      excluded_exercises: ['squat', 'front_squat', 'leg_press'],
    })
    expect(w).toBeNull()
  })

  it('con equipment "bodyweight" Push non è generabile (nessuna stazione petto/spalle è a corpo libero pura per tutte le stazioni necessarie)', () => {
    const w = generaDensity369(catalogo, { split: 'push', equipment: 'bodyweight', excluded_exercises: [] })
    expect(w).toBeNull()
  })
})

describe('generaDensity369 — durata stimata', () => {
  it('la durata stimata è un numero positivo e ragionevole (fra 15 e 90 minuti)', () => {
    for (const split of SPLIT_PPL) {
      const w = generaDensity369(catalogo, { split, equipment: 'full_gym', excluded_exercises: [] })
      expect(w!.estimated_duration_min).toBeGreaterThan(15)
      expect(w!.estimated_duration_min).toBeLessThan(90)
    }
  })
})

describe('generaDensity369 — tutti gli split supportati', () => {
  for (const split of TUTTI_GLI_SPLIT_SUPPORTATI) {
    it(`${split}: genera sempre 2 blocchi di 3 stazioni, senza conflitti fra stazioni`, () => {
      const w = generaDensity369(catalogo, { split, equipment: 'full_gym', excluded_exercises: [] })
      expect(w).not.toBeNull()
      expect(w!.blocks).toHaveLength(2)
      for (const blocco of w!.blocks) expect(blocco.stations).toHaveLength(3)
      const tuttiGliId = w!.blocks.flatMap((b) => b.stations.map((s) => s.exercise_id))
      expect(new Set(tuttiGliId).size).toBe(tuttiGliId.length)
    })
  }

  it('bro_shoulders e full_body non hanno un template: solo 11 split sono supportati', () => {
    expect(TUTTI_GLI_SPLIT_SUPPORTATI).toHaveLength(11)
  })
})
