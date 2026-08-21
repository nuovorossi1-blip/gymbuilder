import { describe, expect, it } from 'vitest'
import { avanza, durataFaseSec, progressoTesto, statoIniziale, stazioneCorrente } from './densityRunnerEngine'
import type { Density369Workout } from '../generators/density369'

// Workout minimo costruito a mano (non serve il generatore vero: qui si testa solo la
// macchina a stati, non le scelte di esercizio) — 2 giri nel Blocco A, 1 giro nel Blocco B,
// così la sequenza di transizioni è breve da seguire ma copre comunque ogni tipo di fase.
function workoutDiProva(): Density369Workout {
  const stazione = (role: 1 | 2 | 3, id: string) => ({ role, exercise_id: id, name: id, muscle: 'chest' as const, reps: '3-6', rest_after_sec: 12 })
  return {
    name: 'Prova',
    split: 'push',
    block_transition_rest_sec: 200,
    blocks: [
      { label: 'A', rounds: 2, round_rest_sec: 180, stations: [stazione(1, 'a1'), stazione(2, 'a2'), stazione(3, 'a3')] },
      { label: 'B', rounds: 1, round_rest_sec: 120, stations: [stazione(1, 'b1'), stazione(2, 'b2'), stazione(3, 'b3')] },
    ],
    estimated_duration_min: 30,
  }
}

describe('densityRunnerEngine — sequenza completa', () => {
  it('percorre l\'intera sessione (2 giri Blocco A, 1 giro Blocco B) nell\'ordine corretto, fase per fase', () => {
    const w = workoutDiProva()
    let s = statoIniziale()
    const sequenza: string[] = []

    while (s.phase !== 'completato') {
      sequenza.push(`${s.phase}:${progressoTesto(s, w)}:${stazioneCorrente(s, w).exercise_id}`)
      s = avanza(s, w)
    }
    sequenza.push('completato')

    expect(sequenza).toEqual([
      'lavoro:Blocco A · Giro 1/2 · Stazione 1/3:a1',
      'riposo_stazione:Blocco A · Giro 1/2 · Stazione 2/3:a2',
      'lavoro:Blocco A · Giro 1/2 · Stazione 2/3:a2',
      'riposo_stazione:Blocco A · Giro 1/2 · Stazione 3/3:a3',
      'lavoro:Blocco A · Giro 1/2 · Stazione 3/3:a3',
      'riposo_giro:Blocco A · Giro 1/2 · Stazione 3/3:a1', // fine giro: la prossima stazione mostrata è già a1 del giro 2
      'lavoro:Blocco A · Giro 2/2 · Stazione 1/3:a1',
      'riposo_stazione:Blocco A · Giro 2/2 · Stazione 2/3:a2',
      'lavoro:Blocco A · Giro 2/2 · Stazione 2/3:a2',
      'riposo_stazione:Blocco A · Giro 2/2 · Stazione 3/3:a3',
      'lavoro:Blocco A · Giro 2/2 · Stazione 3/3:a3',
      'riposo_blocco:Blocco A · Giro 2/2 · Stazione 3/3:b1', // fine Blocco A: la prossima è b1 del Blocco B
      'lavoro:Blocco B · Giro 1/1 · Stazione 1/3:b1',
      'riposo_stazione:Blocco B · Giro 1/1 · Stazione 2/3:b2',
      'lavoro:Blocco B · Giro 1/1 · Stazione 2/3:b2',
      'riposo_stazione:Blocco B · Giro 1/1 · Stazione 3/3:b3',
      'lavoro:Blocco B · Giro 1/1 · Stazione 3/3:b3',
      'completato',
    ])
  })

  it('avanzare oltre "completato" non cambia più nulla', () => {
    const w = workoutDiProva()
    let s = statoIniziale()
    for (let i = 0; i < 17; i++) s = avanza(s, w)
    expect(s.phase).toBe('completato')
    const dopo = avanza(s, w)
    expect(dopo).toEqual(s)
  })
})

describe('densityRunnerEngine — durata delle fasi di riposo', () => {
  it('riposo_stazione dura il rest_after_sec della stazione appena fatta', () => {
    const w = workoutDiProva()
    const dopoStazione1 = avanza(statoIniziale(), w) // riposo_stazione dopo a1
    expect(dopoStazione1.phase).toBe('riposo_stazione')
    expect(durataFaseSec(dopoStazione1, w)).toBe(12)
  })

  it('riposo_giro dura round_rest_sec del blocco (180 per A, 120 per B)', () => {
    const w = workoutDiProva()
    let s = statoIniziale()
    for (let i = 0; i < 5; i++) s = avanza(s, w) // fino a riposo_giro di fine Blocco A giro 1
    expect(s.phase).toBe('riposo_giro')
    expect(durataFaseSec(s, w)).toBe(180)
  })

  it('riposo_blocco dura block_transition_rest_sec del workout, non del blocco', () => {
    const w = workoutDiProva()
    let s = statoIniziale()
    for (let i = 0; i < 11; i++) s = avanza(s, w) // fino a riposo_blocco fine Blocco A
    expect(s.phase).toBe('riposo_blocco')
    expect(durataFaseSec(s, w)).toBe(200)
  })

  it('lavoro e completato non hanno durata (0): sono a conferma manuale, non a timer', () => {
    const w = workoutDiProva()
    expect(durataFaseSec(statoIniziale(), w)).toBe(0)
    let s = statoIniziale()
    for (let i = 0; i < 17; i++) s = avanza(s, w)
    expect(durataFaseSec(s, w)).toBe(0)
  })
})
