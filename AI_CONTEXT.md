# AI Context — GymBuilder

GymBuilder è una web app React 18/Vite mobile-first che genera, salva ed esegue allenamenti deterministici. Backend, autenticazione e persistenza sono Supabase. Il motore non usa un LLM.

## Flusso prodotto

`Genera → giorni e discipline → configurazione globale → settimana modificabile → singolo giorno → anteprima → Salva oppure Inizia`.
La navigazione pubblica contiene solo Genera, Salvati e Profilo. Le modalità pubbliche sono Bodybuilding, CrossFit Standard, CrossFit Hybrid, Forza e Tabata. Conditioning resta un motore interno/legacy, non è selezionabile dalla home.

## Dove guardare

- `src/types/index.ts`: modelli e label.
- `src/pages/Create.tsx`: configurazione effimera della generazione.
- `src/generators/`: motori deterministici esistenti.
- `src/engine/weeklyPlan.ts`: Weekly Program Engine fitness-aware.
- `src/engine/`: policy, sostituzioni, validazione workout e timer.
- `src/pages/WorkoutPreview.tsx`: scheda, salvataggio e cambio esercizio.
- `src/pages/Runner.tsx`: runner pesi e Metcon/Tabata.
- `src/lib/api.ts`: accesso Supabase.
- `supabase/migrations/`: schema versionato.

## Stato verificato

Al 2026-08-06: 131 test verdi, build verde, lint senza errori. Le migrazioni dati fisici e `saved_workout_generation_config` devono essere applicate al progetto Supabase remoto. I provider wearable reali non sono implementati: esiste il contratto modulare `HealthDataProvider` e il fallback MET.

## Prossimo passo

Applicare la migrazione remota, verificare con un account autenticato Genera → Salva → Inizia e integrare adapter HealthKit/Health Connect solo in un contenitore mobile compatibile.
