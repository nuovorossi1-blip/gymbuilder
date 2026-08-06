# Decisions

## 2026-08-06 — Profilo e Genera separati

Le impostazioni di allenamento non sono più editabili nel Profilo. Il Profilo espone solo identità, email e dati fisici. La configurazione corrente viaggia con il workout in sessione.

## 2026-08-06 — Conditioning interno

Il motore legacy non è stato eliminato perché CrossFit e test condividono concetti Metcon utili. È escluso dalla navigazione pubblica tramite `PUBLIC_MODES`.

## 2026-08-06 — Refactoring incrementale

I generatori già coperti da oltre cento test sono stati mantenuti e circondati da modelli e servizi centrali, evitando una riscrittura ad alto rischio.

## 2026-08-06 — Wearable onesto e modulare

Nessun valore HR inventato. `HealthDataProvider` è il confine per adapter futuri; senza HR si usa una stima MET esplicitamente etichettata.

## 2026-08-06 — Weekly Engine prima del Workout Engine

La programmazione settimanale è un dominio separato. Decide disciplina/split/ordine con una vista sull'intera settimana; i generatori esistenti ricevono poi un solo `WeeklySession`. Configurazione e settimana restano in sessione quando l'utente salva, avvia o torna indietro.

## 2026-08-06 — Scoring esaustivo e feedback deterministico

Con al massimo sette sessioni, valutare fino a 7! candidati è semplice e verificabile. Il feedback non usa ML: conserva contatori per motivo e influenza solo la scelta fra alternative già valide. Il disagio evita prudenzialmente lo stesso pattern senza formulare diagnosi.
