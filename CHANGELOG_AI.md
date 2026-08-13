# Changelog AI

## 2026-08-13 - Target custom BB, livelli esperienza reali e DeepSeek locale

- Ripristinate tre fasce esperienza distinte nell'interfaccia: `Principiante`, `Intermedio`, `Avanzato`.
- Aggiunto nel wizard `Genera` un selettore esperienza esplicito.
- La sessione singola Bodybuilding salva e usa `custom_target_muscles`, cosi una seduta spalle/braccia non reinserisce piu automaticamente il petto.
- I gruppi carenti inclusi nel target custom vengono pesati di piu, restando entro il limite massimo di 6 esercizi.
- `poolMetcon` accetta anche movimenti `metcon_safe`, rendendo piu robusta la generazione CrossFit/Hybrid quando il catalogo e imperfetto.
- Il Profilo include ora configurazione locale DeepSeek (chiave API e modello) salvata solo sul dispositivo.
- Il wizard `Genera` espone un prompt libero e un pulsante `Genera con DeepSeek`: l'AI suggerisce una patch di configurazione e la generazione finale resta nel motore interno.
- Verifica completata: `npm test` verde con 194 test passati e `npm run build` verde.

## 2026-08-12 ? Sessione attiva globale e base Android Capacitor

- Introdotto un `ActiveWorkoutSession` persistente nel `WorkoutContext`, separato dal solo `Runner`: adesso la sessione attiva ha un proprio `sessionId` e pu? essere ripresa dagli entrypoint principali senza creare un nuovo avvio.
- `/avvia`, Home, anteprima, salvati e banner timer convergono tutti sul resume della sessione attiva invece di dipendere solo dal `workout` in memoria della singola pagina.
- `public/sw.js` non naviga pi? ciecamente il primo client trovato: rifocalizza la finestra corretta e invia il messaggio `RESUME_ACTIVE_SESSION` all'app.
- Aggiunta sincronizzazione tra istanze browser via evento `storage` per `workout`, config e sessione attiva.
- Integrato Capacitor Android con `capacitor.config.ts`, dipendenze dedicate e script `cap:sync`, `cap:copy`, `cap:open:android`.
- Configurata l'app Android per caricare il frontend live da `https://gymbuilder-lemon.vercel.app`, cos? i deploy web aggiornano automaticamente l'app installata senza richiedere un nuovo APK per le sole modifiche frontend.
- Verifica completata: `npm test` verde, `npm run build` verde, `npm run cap:sync` riuscito, progetto `android/` generato correttamente.
- Primo tentativo `assembleDebug` fermato solo dall'ambiente locale: manca l'Android SDK (`ANDROID_HOME` / `sdk.dir`), non dal codice del repository.

## 2026-08-12 — Resume runner affidabile e toolchain cross-platform

- Corretto il resume del Runner quando l'app web va in background o viene riaperta durante un allenamento già iniziato.
- `src/pages/Runner.tsx` salva ora l'intero stato vivo della sessione in `localStorage`: sezione corrente, fase serie/recupero, countdown, deadline reali, round/intervallo Tabata, cronometro Metcon e stato pausa.
- Il ripristino usa i timestamp salvati per ricalcolare il tempo residuo reale invece di riavviare il Tabata da `giro 1`.
- L'auto-start del Tabata viene eseguito solo dopo l'idratazione del Runner, evitando il reset involontario della sessione al rientro.
- Rimossa da `package.json` la devDependency Linux-only `@rolldown/binding-linux-x64-gnu`, che bloccava `npm install` su Windows pur non essendo richiesta da Vite.
- Verifica locale completata dopo il fix toolchain: `npm test` verde con 193 test passati e `npm run build` riuscito.

## 2026-08-07 — Programma prima, esercizi dopo

- I programmi costruiscono e salvano prima calendario, discipline e split; gli esercizi vengono generati soltanto aprendo una giornata confermata.
- PPL BB + Hybrid su cinque giorni segue Push, Pull, Legs, riposo, HY specializzazione, HY funzionale, riposo.
- La prima HY riceve le carenze upper assegnate; la seconda resta Functional/Full Body senza volume diretto aggiuntivo sulle carenze.
- Aggiunta la distribuzione BB dominante / equilibrata / HY più frequente.
- Una sessione singola seleziona direttamente Push/Pull/Legs/Upper/Lower/Front/Back/Bro e apre subito l'anteprima, senza creare un calendario fittizio.
- Bro Petto singolo usa cinque esercizi: due compound e tre isolamenti esclusivamente per il petto.
- Front/Back + CrossFit su quattro giorni alterna Front, CrossFit, riposo, Back, CrossFit.

## 2026-08-07 — Nomi e istruzioni catalogo curate

- Tutti i 141 esercizi attivi hanno ora un nome italiano naturale quando traducibile e un cue esecutivo breve e specifico; termini tecnici consolidati restano in inglese.
- Rimossi tutti i testi generici dalle varianti Bodybuilding e CrossFit; il rematore chest-supported è ora “Rematore con manubri su panca a 45°” con istruzione dedicata.
- Disattivata la Leg Extension unilaterale duplicata e ricondotte le sostituzioni alla Leg Extension classica.
- Le vecchie schede salvate vengono aggiornate in memoria con nomi e istruzioni del catalogo corrente quando vengono aperte.

## 2026-08-07 — PPL separata dall'obiettivo settimanale

- La priorità globale serve soltanto allo scheduling delle discipline e non cambia più ripetizioni/recuperi della giornata Bodybuilding.
- PPL resta sempre una split Bodybuilding orientata all'ipertrofia; Forza, CrossFit e Hybrid mantengono generatori separati.
- Rimossa l'ambiguità concettuale “PPL Conditioning” / “PPL Mista” dal testo del configuratore.

## 2026-08-07 — Segnale finale countdown distinto

- I secondi 3–2–1 producono tre bip brevi; allo zero viene emesso un evento separato con biiip lungo, diiing lungo o riiing secondo la preferenza.
- La modalità silenziosa può usare soltanto una vibrazione lunga e riconoscibile se la vibrazione è attiva.

## 2026-08-07 — Apertura compound universale

- Bodybuilding, Forza e Hybrid condividono ora un'invariante finale: richiami, carenze e isolamenti non possono precedere il primo esercizio compound multiarticolare.
- L'ordine relativo degli esercizi successivi resta quello specifico della disciplina e dello split.

## 2026-08-07 — CrossFit completo, livelli e metodiche separate

- Livelli pubblici ridotti a Principiante (include Intermedio) e Avanzato; il valore intermedio resta leggibile solo per retrocompatibilità.
- Espanso il catalogo remoto da 118 a 142 esercizi con movimenti CrossFit cardio, ginnastica e sollevamento olimpico.
- CrossFit Standard spiegato nell'interfaccia e mantenuto full body, funzionale e senza isolamento bodybuilding.
- Hybrid non può più iniziare con affondi/unilaterali quando è disponibile un compound bilaterale.
- Forza usa cinque esercizi strutturali: tre fondamentali e due complementari; Bodybuilding + Forza identifica le giornate Powerlifting.
- CrossFit + Forza usa alzate iniziali e un Metcon Hybrid con condizione e complementari controllati.
- Quando l'app passa in background viene pubblicata subito una notifica persistente con il tempo residuo e deep-link al Runner.

## 2026-08-07 — PWA, timer globale e continuità allenamento

- GymBuilder è installabile come PWA e dispone di Service Worker con shell offline e apertura diretta del Runner dalle notifiche.
- Aggiunto un mini-timer globale in alto quando si naviga dentro l'app durante un recupero o un intervallo attivo.
- Le notifiche del timer usano la registrazione Service Worker dove disponibile, con fallback browser.
- Una sessione locale attiva resta visibile durante errori di rete o rinnovo della sessione Supabase; il caricamento Auth non rimane bloccato.
- Aggiunti nel Runner Indietro, Pausa/Riprendi e Stop con conferma; l'eliminazione delle schede salvate è ora esplicita, confermata e gestisce gli errori.

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
## 2026-08-07 — Programmi limitati a due discipline e metodiche dedicate

- La sessione singola accetta una sola disciplina; il programma settimanale ne accetta una o due, mai tre.
- Forza espone metodiche reali 5×5, 3×5, forza massimale e forza con complementari.
- CrossFit conserva i propri sette formati; Hybrid permette focus e formato separati dalla split Bodybuilding.
- Forza + CrossFit su sei giorni alterna tre sedute per disciplina con riposo il giovedì.
- Ogni CrossFit successivo evita i distretti più affaticati dalla seduta Forza precedente.
- Aggiunti test di regressione per combinazioni triple, prescrizioni Forza e calendario adattivo; 175 test verdi.
## 2026-08-07 — Selettore discipline leggibile e sostituzione automatica

- Il configuratore parte con una sola disciplina, Bodybuilding, invece di preselezionare BB + Hybrid.
- Le discipline sono disposte in una griglia con riepilogo esplicito della combinazione attiva e contatore 1/2 o 2/2.
- Se sono già attive due discipline, sceglierne una nuova sostituisce la seconda: BB + Hybrid può diventare direttamente BB + CrossFit.
- I pannelli specifici Hybrid, CrossFit e Forza compaiono soltanto quando la disciplina corrispondente è realmente attiva.
- Aggiunto test di regressione della selezione; 176 test verdi.
## 2026-08-07 — Configuratore basato su preferenze, metodiche automatiche

- Rimossi dalla UI Priorità settimanale, Intensità e selettori delle metodiche Forza, CrossFit e Hybrid.
- L’utente sceglie soltanto struttura del programma e preferenze comprensibili: discipline, split BB, livello, durata, attrezzatura, carenze e policy.
- Il motore deduce obiettivo interno, intensità, metodo Forza e formato CrossFit/Hybrid dalla configurazione e dalla fatica.
- La pagina è stata trasformata in schede grafiche separate con un riepilogo della programmazione automatica.
- Aggiunti test sulla deduzione automatica; 177 test verdi.
## 2026-08-07 — Metodologia manuale soltanto nella sessione singola

- Il programma settimanale continua a scegliere automaticamente tutte le metodiche.
- La sessione singola Forza permette 5×5, 3×5, forza massimale o forza con complementari.
- La sessione singola CrossFit permette i sette formati WOD; Hybrid permette focus e formato.
- Le scelte della sessione singola non vengono sovrascritte dal motore, neppure in presenza di carenze.
- Aggiunto test di regressione; 178 test verdi.
## 2026-08-07 — Settimana CrossFit leggibile, istruzioni WOD e corda

- Gli avvisi settimanali duplicati vengono aggregati; un programma solo CrossFit mostra un unico riepilogo sul recupero.
- Ogni giornata CrossFit riceve un formato diverso scelto dal motore e visibile nel calendario.
- Anteprima e Runner spiegano per ogni formato giri, ordine, pause, punteggio e condizione di termine.
- Single Under e Double Under sono ora cardio monostrutturale in CrossFit, Hybrid, Conditioning e Tabata.
- Principiante usa Single Under; Avanzato usa Double Under. Aggiornati nomi e cue nel catalogo Supabase remoto.
- Aggiunti test per warning, istruzioni Metcon e progressione corda; 188 test verdi.
