# Changelog AI

## 2026-08-06 — Weekly Program Generator multi-modalità

- Aggiunti `WeeklyProgramConfig`, `WeeklySession`, `WeeklyProgram` e warning tipizzati.
- Trasformato `weeklyPlan.ts` in un motore fitness-aware indipendente dalla UI.
- Aggiunta selezione simultanea da una a cinque discipline su 3-7 giorni.
- Distribuzione pesata per obiettivo, split dinamici e ordinamento per recupero/sovrapposizione.
- Aggiunta settimana completa modificabile per giorno, modalità e split.
- Configurazione globale, programma e giorno corrente persistono durante anteprima e Runner.
- Il termine del Runner e l'anteprima tornano alla settimana senza perderla.
- I workout salvati includono la configurazione con migrazione JSONB dedicata.
- Aggiunti test A–I, modifica manuale, Tabata complementare e configurazioni non valide.
- Totale: 131 test verdi; build verde; lint senza errori.

## 2026-08-06 — Ristrutturazione master

- Rimossa Conditioning dalle modalità e dalla navigazione pubblica.
- Navigazione principale ridotta a Genera, Salvati e Profilo.
- Aggiunti modelli `UserProfile`, `WorkoutGenerationConfig`, `ExercisePreference`, `EquipmentInventory`, `WorkoutSession`.
- Aggiunto piano settimanale Bodybuilding per PPL, Upper/Lower, Bro Split e Front/Back su 2-7 giorni.
- Spostate livello, obiettivo, durata, attrezzatura, weak point e preferenze nel flusso Genera.
- Profilo ridotto a account e dati fisici; aggiunta migrazione Supabase.
- Aggiunti servizi centrali per policy, validazione, sostituzione e timer.
- Reso configurabile Tabata per lavoro, riposo, round e prescrizione tempo/ripetizioni.
- Aggiunto cambio del singolo esercizio in anteprima.
- Esteso il calorie estimator con contratto wearable, formula HR e fallback MET.
- Corretto il richiamo incrociato tricipiti nel Pull.
- Aggiunti test master; totale verificato: 118 test verdi.
- Aggiunto binding Rolldown Linux necessario all'esecuzione affidabile di Vitest nell'ambiente corrente.
