# Changelog AI

## 2026-08-07 — Programmi multi-settimana, Hybrid e timer background

- Separati Programma e Sessione singola: il programma dura minimo due settimane ed è salvato su Supabase prima di mostrare le giornate; la sessione singola resta effimera.
- Aggiunta `training_programs` con RLS proprietaria completa per SELECT/INSERT/UPDATE/DELETE.
- PPL a quattro giorni usa il quarto giorno per carenze Upper/Lower oppure Total Body senza carenze; a cinque giorni resta PPL + Upper/Lower.
- I programmi Bodybuilding + Hybrid su cinque giorni distribuiscono tre sessioni PPL e due Hybrid senza accodare le due Hybrid.
- Hybrid supporta AMRAP, EMOM, For Time e Intervals applicati a cardio e isolamenti bodybuilding leggeri; le sessioni A/B alternano AMRAP ed EMOM.
- Il Replacement Engine restituisce una graduatoria completa, mantiene lo slot ed è ora compatibile con gli isolamenti bodybuilding inseriti nei Metcon Hybrid.
- Il timer web aggiorna il titolo in background e invia notifiche per lavoro, recupero, fine e time cap, oltre a bip e vibrazione.
- Verifica: 166 test, lint senza errori e build Vite verde; migrazione programmi applicata e policy remote verificate.

## 2026-08-07 — Catalogo esercizi curato e metadati interni

- Espanso il catalogo Supabase da 88 a 118 esercizi attivi con 30 varianti realmente distintive per traiettoria, supporto, presa, unilateralità o attrezzatura.
- Mantenute separate varianti utili come T-Bar Row libera e rematore con manubri chest-supported; evitati alias che cambiano soltanto il nome.
- Aggiunti `stability_profile`, `axial_load` e `unilateral` come metadati interni del motore, mai esposti nella scheda utente.
- Corrette Leg Extension come `knee_extension`, le alzate polpacci come `calf_raise`, Chin-up e Glute Bridge come compound.
- Il Replacement Engine considera ora anche stabilità, carico assiale e unilateralità, oltre a muscolo, pattern, tipologia, attrezzatura e fatica.
- Rimossa una policy SELECT Supabase duplicata; resta una sola policy per gli esercizi attivi.
- Verifica: 159 test, lint senza errori, build Vite verde, query remote e advisor Supabase eseguiti.

## 2026-08-07 — Priorità muscolari program-aware

- Sostituita la vecchia regola “tutte le carenze in ogni sessione” con assegnazione settimanale coerente al sistema scelto.
- PPL: laterali nel Push, posteriori nel Pull, braccia in entrambi come lavoro principale/richiamo; Legs resta gambe.
- Upper/Lower: laterali e posteriori ruotano fra Upper A/B; Lower non riceve richiami upper.
- Front/Back: laterali nel Front, posteriori nel Back, braccia distribuite in entrambi.
- Bro Split: lavoro principale nei giorni Spalle/Braccia e richiami anatomici nei giorni Petto/Dorso; Legs resta gambe.
- Ridotto il limite Bodybuilding a sei esercizi; i richiami fuori split usano due serie.
- Push specializzato ordinato come petto, petto, laterali, compound moderato, bicipiti, tricipiti.
- Verifica: 158 test, lint senza errori e build Vite verde.

## 2026-08-07 — Ordine esercizi, countdown e Belt Squat

- Legs ordinato per fatica e tecnica: quad compound bilaterale, femorali compound, glutei, isolamento quad, isolamento femorali, polpacci.
- Gli squat/pressa hanno priorità sugli affondi unilaterali nel primo slot; Affondo bulgaro non può più aprire una Legs con palestra completa.
- Push esegue i due press petto prima del press spalle e alterna gli accessori per ridurre la fatica locale consecutiva.
- Countdown finale reso più udibile con tre beep distinti a 3–2–1 e vibrazione opzionale dove supportata.
- Aggiunto Belt Squat al catalogo locale e Supabase remoto come compound quad-dominant.
- Dynamic Island specificata in roadmap come Live Activity nativa ActivityKit/WidgetKit, non simulata nella web app.
- Verifica: 156 test, lint senza errori, build Vite verde e advisor Supabase senza regressioni.

## 2026-08-07 — Salvataggio profilo `id`/`user_id`

- Corretto il `400` dell'upsert profilo: il client invia ora sia la PK legacy `id` sia il contratto corrente `user_id`.
- Aggiornato `handle_new_user` perché valorizzi entrambe le chiavi per le nuove registrazioni.
- Reso `profiles.user_id` obbligatorio dopo il riallineamento dei record esistenti.
- Rimosse le tre policy RLS legacy basate su `id`; restano SELECT/INSERT/UPDATE proprietarie basate su `user_id`.
- Migrazione remota applicata; 2/2 profili allineati, nessun `user_id` mancante.
- Verifica locale: 153 test e build Vite verdi; advisor sicurezza senza nuove regressioni.

## 2026-08-07 — Migrazioni Supabase remote allineate

- Autenticata la CLI sul progetto `geqhxhgrameaugawmaej`, escludendo il token Codespaces obsoleto.
- Importate nel repository le nove migrazioni storiche già presenti sul remoto senza sovrascrivere le cinque locali.
- Applicate le migrazioni catalogo v2, attrezzatura avanzata, dati fisici, `generation_config` e contratto/RLS del profilo.
- Verificato l'allineamento di tutte le 14 versioni locali e remote.
- Verificate le nuove colonne, 87 esercizi completi e le policy SELECT/INSERT/UPDATE del profilo.
- Advisor sicurezza senza regressioni; resta il WARN preesistente sulla protezione password compromesse disattivata.

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
