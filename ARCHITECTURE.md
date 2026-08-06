# Architecture

## Livelli

1. UI: `pages`, `components`, `features`.
2. Orchestrazione: `WorkoutContext`, configurazione globale e settimana persistita.
3. Regole condivise: `src/engine` e `src/generators/shared.ts`.
4. Motori modalità: `bodybuilding`, `strength`, `crossfit`, `hybrid`, `tabata`.
5. Dati: `lib/api.ts`, normalizzazione catalogo e Supabase.

## Modelli separati

- `UserProfile`: identità e dati fisici.
- `WorkoutGenerationConfig`: tutte le scelte della singola generazione.
- `WeeklyProgramConfig`: discipline e preferenze globali della settimana.
- `WeeklyProgram`/`WeeklySession`: piano modificabile e singoli giorni tipizzati.
- `EquipmentInventory` e `ExercisePreference`: regole di ammissibilità.
- `GeneratedWorkout`/`SavedWorkout`: prescrizione e copia persistita.
- `WorkoutSession`: esecuzione, durata, HR opzionale e calorie stimate.

`conditioning.ts` è mantenuto per compatibilità e riuso tecnico, ma non compare in `PUBLIC_MODES`.

## Pipeline settimanale

`WeeklyProgramConfig → generateWeeklyProgram → WeeklyProgram → WeeklySession → generatore modalità → validateWorkout → anteprima`.

Il Weekly Engine decide disciplina, split e ordine dei giorni. I generatori esistenti decidono esercizi, serie, recuperi e timer. La settimana è versionata in `sessionStorage` e sopravvive a anteprima e Runner.

## Persistenza

Supabase conserva profili, impostazioni legacy, catalogo, salvati e completati. Le nuove colonne fisiche sono versionate nella migrazione `20260806120000_profile_physical_data.sql`; la configurazione usata dal workout salvato nella migrazione `20260806123000_saved_workout_generation_config.sql`. Sessione e settimana correnti sono recuperabili da `sessionStorage`.
