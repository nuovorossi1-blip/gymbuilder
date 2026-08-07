import type { WorkoutBlock } from '../types'

export function metconSubtitle(block: WorkoutBlock): string {
  switch (block.format) {
    case 'amrap': return `${block.time_cap_min} min · più giri possibili`
    case 'for_time': return `${block.rounds ?? 1} giri · cap ${block.time_cap_min} min`
    case 'rounds': return `${block.rounds} giri · il tempo totale è il punteggio`
    case 'circuit': return `${block.rounds} giri · recuperi programmati`
    case 'emom': return `${block.rounds} min · un compito ogni minuto`
    case 'intervals': return `${block.interval_sec}″ lavoro per intervallo`
    case 'tabata': return `${block.rounds}×20″/10″`
    case 'chipper': return `1 giro · cap ${block.time_cap_min} min`
    case 'ladder': return `scala crescente · cap ${block.time_cap_min} min`
    default: return ''
  }
}

export function metconInstruction(block: WorkoutBlock): string {
  switch (block.format) {
    case 'amrap': return 'Esegui gli esercizi nell’ordine e ricomincia dal primo. Continua fino allo zero: conta i giri completi e le ripetizioni extra. Non c’è una pausa obbligatoria; recupera solo quando serve.'
    case 'for_time': return `Completa ${block.rounds ?? 1} ${block.rounds === 1 ? 'giro' : 'giri'}. In ogni giro esegui tutti gli esercizi nell’ordine, poi riparti dal primo. Non c’è una pausa obbligatoria: fermati quando completi il volume o quando scade il cap.`
    case 'rounds': return `Completa ${block.rounds ?? 1} giri eseguendo ogni volta tutti gli esercizi nell’ordine. Riposa solo quanto serve; il cronometro continua e il tempo finale è il punteggio.`
    case 'circuit': return `Completa ${block.rounds ?? 1} giri. Passa da un esercizio al successivo e usa i recuperi indicati; dopo l’ultimo esercizio ricomincia dal primo.`
    case 'emom': return 'All’inizio di ogni minuto esegui il compito indicato. Il tempo che rimane prima del minuto successivo è recupero; poi passa alla stazione seguente.'
    case 'intervals': return 'Esegui la stazione durante il tempo di lavoro, poi recupera per l’intervallo indicato. Al segnale passa all’esercizio successivo e continua per tutti i round.'
    case 'tabata': return 'Lavora 20 secondi e riposa 10 secondi per 8 round sullo stesso movimento; poi passa al movimento successivo.'
    case 'chipper': return 'Esegui ogni esercizio una sola volta, nell’ordine, completando tutte le ripetizioni prima di passare al successivo. Il cronometro continua fino alla fine o al cap.'
    case 'ladder': return 'Esegui tutti gli esercizi con 2 ripetizioni, poi ricomincia con 4, quindi 6, 8 e 10. Riposa solo quando serve e termina entro il cap.'
    default: return ''
  }
}
