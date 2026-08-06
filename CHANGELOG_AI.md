# Changelog AI

## 2026-08-06 — Carenze obbligatorie in ogni sessione Bodybuilding

- Trasformate le carenze da richiamo condizionale a requisito strutturale della seduta.
- Raggruppati deltoide anteriore/laterale/posteriore in un requisito spalle per sessione.
- Riservato uno slot distinto a bicipiti e tricipiti quando selezionati.
- Gli extra non prioritari, come le croci aggiuntive, cedono lo slot alle carenze.
- Legs conserva almeno quattro slot identitari e può usare tre slot per spalle/braccia, restando entro sette esercizi.
- Il replacement di un richiamo fuori split mantiene pattern, muscolo e ruolo.
- Test completi: 153/153 verdi; build e asset Vite verificati.
- Commit produzione `e9bcc38` tramite PR #4; deployment Vercel `DedRcx36UrFwvixGto6aNWGeHKMa` completato.
- Verifica pubblica: homepage, JS `index-DSl8TQl0.js` e CSS `index-CCYuonA-.css` rispondono HTTP 200.

## 2026-08-06 — Regole PPL, Profile e Timer Audio

- Corretto il difetto che ammetteva Thruster in Push: muscolo+ruolo non bastano più, ora lo slot impone anche il movement pattern.
- Aggiunti test espliciti Push, Pull e Legs con carenze globali spalle/braccia.
- Il Replacement Engine riceve lo split e non può sostituire un esercizio con un pattern estraneo al giorno.
- Allineato il client Profile da `id` a `user_id`; aggiunta migration con colonne fisiche, unique index, grant e policy SELECT/INSERT/UPDATE proprietarie.
- Creati Unified Timer Engine e Audio Engine: timestamp reali, pausa senza drift, countdown, work/rest/round/set, AMRAP, EMOM, For Time, Tabata, cap e completamento.
- Runner dotato di Audio timer ON/OFF, Beep/Ding/Silenzioso e countdown configurabile.
- `npm install` eseguito; 149 test verdi; build Vite verde; asset CSS referenziato presente in `dist`.
- Supabase remoto non modificato: il progetto usato dalla produzione non è esposto al connettore corrente.
- Commit produzione `64112ac` tramite PR #3; Vercel deployment `Gb3wGEvzb24GdQ4c7RhWsqaDndMZ` completato.
- Verifica pubblica: homepage, bundle JS e CSS hashati rispondono HTTP 200; bundle contiene Timer Audio e contratto Profile aggiornato.

## 2026-08-06 — Recovery scoring ed Exercise Feedback Engine

- Chiarite nell’interfaccia le differenze fra obiettivi globali e discipline.
- Aggiunto `RecoveryProfile` previsto e calcolato dagli esercizi reali.
- Sostituito l’ordinamento greedy con scoring esaustivo delle permutazioni settimanali.
- Aggiunto pannello feedback con sei motivazioni.
- Aggiunti rifiuto temporaneo, esclusione futura, aggiornamento inventario e memoria adattiva.
- Replacement ranking esteso a pattern, ruolo, muscolo, difficoltà, fatica, livello e feedback.
- Aggiunti sei test funzionali del feedback; totale 137 test verdi.
- Commit produzione `8344953`; Vercel deployment `99Z9q62KR9DgFqZbReyNyK9m9Wkv` completato.
- Verifica pubblica: homepage HTTP 200 e bundle contenente Feedback Engine e descrizioni obiettivi.

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
