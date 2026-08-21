# STATO DEL PROGETTO — GYMBUILDER

> File di memoria AI-OS. Chi apre questo progetto con `/handoff gymbuilder` legge
> da qui. Va **aggiornato** a ogni sessione, non accodato all'infinito.
> L'identità del progetto e il percorso di AI-OS stanno in `AIOS_PROJECT.json`.

**Ultimo aggiornamento:** 2026-08-21 (dip Push vincolato a dip_parallele, non più casuale + tasto "Torna alla Settimana" dopo il salvataggio — vedi fondo file) - Claude (Sonnet 5)

Etichette: `[FACT]` verificato nel codice · `[RICOSTRUITO]` dedotto da indizi ·
`[IGNOTO]` non ricavabile dal repository

---

## REGOLA PERMANENTE — vale per qualsiasi LLM che lavora su questo progetto

Prima di rispondere all'utente su qualsiasi lavoro fatto (anche piccolo), aggiorna questo file
con tutti e cinque questi punti, non una selezione:

1. **Problemi rilevati** — cosa non andava, e la causa vera (non il sintomo). Se un problema
   segnalato dall'utente non è ancora risolto, resta in "6. Problemi aperti" finché non lo è
   davvero, non finché sembra sistemato.
2. **Cosa è stato fatto** — la modifica reale, non l'intenzione. Scrivilo solo dopo aver
   verificato che funziona (test, build, lettura del codice vero), mai prima.
3. **Cosa c'è ancora da fare** — sia il seguito immediato di questo lavoro, sia le voci più
   vecchie non toccate oggi: non cancellarle solo perché non erano il focus della sessione.
4. **Dove dobbiamo arrivare** — non basta dire cosa è cambiato: rileggi "1. Obiettivo finale"
   e collega il lavoro di oggi a quello, così chi legge non deve indovinare perché è stato fatto.
5. **Cosa aspettarsi** — cosa deve controllare l'utente per verificare che il lavoro sia
   davvero fatto (link da aprire, scenario da provare, dato da guardare), e cosa NON è ancora
   vero (es. "in una PR draft, non ancora in produzione") — mai lasciar credere che qualcosa sia
   live se non lo è.

Questo non sostituisce le regole già scritte più sotto (SALVATAGGIO AUTOMATICO, tabella
"Problemi risolti" da non cancellare mai): le rende esplicite così che nessun LLM le salti per
fretta o per convinzione che "questa volta non serve".

---

## 1. Obiettivo finale

Un'applicazione che genera allenamenti su misura. L'utente non sceglie una scheda
predefinita: dichiara le proprie caratteristiche, gli obiettivi, il tempo che ha
oggi e il tipo di allenamento che vuole fare, e l'app costruisce una sessione
coerente — esercizi, ordine, serie, ripetizioni, recuperi, timer, durata stimata.

Cinque modalità pubbliche: Bodybuilding, Forza, CrossFit Standard, CrossFit
Hybrid e Tabata. Condizionamento resta una categoria/motore tecnico interno e
non è più selezionabile dalla home.

**Vincolo architetturale non negoziabile** (specifica sez. 37): il motore di
generazione è **deterministico e guidato dai dati**, non un LLM. Un LLM potrà in
futuro aggiungere coaching, spiegazioni e varianti, ma l'app deve poter generare
e validare un allenamento anche senza AI.

---

## 2. Dove siamo adesso

**Ristrutturazione master implementata localmente e in verifica infrastrutturale.**
Il flusso è ora Genera → configura → anteprima → Salva/Inizia; il Profilo è
separato dalle preferenze della sessione. I nuovi servizi centrali vivono in
  `src/engine`, la configurazione tipizzata in `WorkoutGenerationConfig`.
La home distingue ora nettamente la sessione attiva dalla creazione: ogni
ingresso `fresh=1` azzera scheda, configurazione, programma e rifiuti precedenti;
la voce inferiore `Ultimo` mostra solo l'ultima sessione completata, mentre
`Salvati` resta l'archivio delle schede salvate.
Il Genera ora supporta più discipline contemporaneamente tramite un Weekly
Program Engine: genera 3-7 giorni, mostra e modifica la settimana, quindi passa
un solo giorno al generatore specifico. Configurazione globale e settimana
restano in `sessionStorage`. Il Weekly Engine usa recovery profile e scoring
esaustivo dei candidati; il replacement integra sei motivazioni e memoria
adattiva locale. Suite aggiornata a 166 test verdi.
L'app ha autenticazione, profilo, un database di 118 esercizi in Supabase (con
istruzioni testuali per ciascuno) e sei motori di generazione:

- **Bodybuilding** (13 split, corretto in profondità in una sessione precedente)
- **Forza** (6 split)
- **CrossFit Standard** (Riscaldamento → Forza/Skill → Metcon AMRAP, niente split)
- **CrossFit Hybrid** (blocco Bodybuilding + Metcon AMRAP/EMOM/For Time/
  Intervals con cardio e isolamenti bodybuilding leggeri)
- **Condizionamento** (nuovo, fase 8: solo Metcon, formato scelto
  dall'utente — AMRAP, EMOM, For Time, Rounds, Circuit, Intervals)
- **Tabata** (nuovo, fase 9: protocollo fisso 20″ lavoro/10″ riposo × 8,
  motore separato perché la prescrizione non è una vera scelta di formato)

Tutti e sei condividono un'infrastruttura comune (`shared.ts`,
`weakPoints.ts`, `calories.ts`) invece di duplicare la logica. In
particolare i quattro motori "da Metcon" (CrossFit Standard, Hybrid,
Condizionamento, Tabata) condividono in `shared.ts` la scelta dei movimenti
(`poolMetcon`, `costruisciCircuito`, `CATEGORIA_PATTERN`, `repsMetcon`):
quello che li distingue è solo come prescrivono tempo/round sul circuito
scelto, non come lo scelgono (vedi sez. 8).

Non restano modalità "in arrivo": `MODES_IN_ARRIVO` in `types/index.ts` è
ora vuoto (sez. 84 della correzione: si mostrava solo finché davvero
mancavano dei motori).

**Sito online:** `gymbuilder-lemon.vercel.app` — **[FACT]**, verificato in
una sessione precedente. Il collegamento automatico GitHub→Vercel **è attivo**
(la nota precedente che lo dava per assente era sbagliata/superata — vedi
problema risolto in sez. 7): ogni push su `main` pubblica da solo in un minuto.
Il commit `e3a824c` è stato pubblicato su `main` e il relativo deployment Vercel
di produzione è `Ready`; il dominio pubblico risponde HTTP 200 e mostra il form
di accesso. Le variabili `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` sono
presenti negli ambienti Preview e Production (valori mantenuti nascosti).

---

## 3. Cosa funziona

- [FACT] Registrazione e accesso con email e password (Supabase Auth)
- [FACT] Alla registrazione un trigger crea automaticamente profilo e impostazioni
  di default: l'utente non trova mai schermate vuote
- [FACT] Pagina Profilo: nome, esperienza, obiettivo, durata abituale, frequenza
  settimanale, attrezzatura, muscoli prioritari, **esercizi preferiti** (nuovo).
  Ogni modifica si salva subito su Supabase con conferma a schermo
- [FACT] Navigazione inferiore a 4 voci (Oggi, Ultimo, Salvati, Profilo)
- [FACT] Minimi inderogabili sugli esercizi allenanti, riscaldamento escluso:
  6 per Bodybuilding/CrossFit/Hybrid, 5 per Forza; Tabata non viene modificato.
  Il vincolo è verificato anche sui workout restituiti da DeepSeek.
- [FACT] Nelle sessioni singole i muscoli scelti/carenze diventano target
  primari rigidi per Bodybuilding, Forza, CrossFit Custom e Hybrid: gli altri
  gruppi possono intervenire come secondari ma non occupano slot principali.
  Validatore e DeepSeek rifiutano risultati fuori target.
- [FACT] Target della giornata e carenze sono dati distinti: una sessione BB
  custom da sei gruppi mantiene uno slot per ciascun gruppo, mentre `weak_points`
  decide quali slot sono prioritari. Nel programma con almeno due sedute BB,
  ogni carenza riceve almeno una seduta principale e un richiamo settimanale
  compatibile, distribuendo il volume senza duplicare due sedute pesanti.
- [FACT] Le tre porzioni del deltoide non vengono più collassate in una sola
  priorità: se anteriore, laterale e posteriore sono tutte carenti ricevono
  ciascuna uno slot. Un Push specializzato da sei esercizi usa petto compound,
  deltoide anteriore compound, laterale, posteriore, bicipiti e tricipiti.
- [FACT] CrossFit espone `WOD personalizzato`, Cindy, Fran, Grace e Helen.
  I benchmark risolvono i movimenti dal catalogo; una variante viene dichiarata
  `adattata`, mentre un benchmark non risolvibile torna a Custom con warning.
- [FACT] L'APK Android include `WorkoutTimerService`: foreground service
  `specialUse`, notifica persistente con cronometro, task `singleTask`, tap che
  riapre la sessione corrente e vibrazione lunga alla scadenza. Il fallback web
  resta basato su service worker/Notification API e non può garantire un overlay
  sopra altre app come un servizio nativo.
- [FACT] RLS attiva su tutte le tabelle (`profiles`, `user_settings`, `exercises`,
  `saved_workouts`, `completed_workouts`): ogni utente legge e scrive solo le
  proprie righe. Verificato con l'advisor di sicurezza Supabase: zero avvisi
  critici (un solo WARN non bloccante, leaked-password-protection disattivata
  nel pannello Auth — non è una regressione di questa sessione)
- [FACT] Interfaccia mobile-first, dark, con focus da tastiera visibile e
  `prefers-reduced-motion` rispettato
- [FACT] Database esercizi: 118 voci attive in Supabase con metadati completi (muscoli
  primari/secondari, attrezzo, movement pattern, ruoli, esperienza minima,
  complessità tecnica, fatica sistemica/locale/di presa, domanda cardio,
  stabilità, carico assiale e unilateralità). Questi ultimi dati restano interni
  al motore e guidano ordine e sostituzioni, senza comparire nella scheda.
- [FACT] Motore Bodybuilding (`src/generators/bodybuilding.ts`), **riscritto in
  questa sessione** — vedi sez. 7 per i motivi. Copre 13 split: Push/Pull/Legs,
  Upper/Lower, Full Body, Bro Split (Petto/Dorso/Spalle/Braccia/Gambe),
  Front/Back. Architettura "struttura-prima": la sessione ha sempre 5-6 slot
  decisi prima di scegliere gli esercizi, non il contrario
- [FACT] Richiami settimanali sui muscoli carenti (`src/generators/weakPoints.ts`):
  legge gli ultimi 7 giorni di `completed_workouts`, stima il volume diretto e
  indiretto per muscolo, e aggiunge un richiamo nella sessione solo se quel
  muscolo è davvero indietro sul target settimanale — non ad ogni sessione
- [FACT] Esercizi preferiti: impostabili in Profilo, letti dal motore, scelti
  con priorità reale (non un vantaggio statistico blando) quando compatibili
  con lo slot in corso
- [FACT] Riscaldamento contestuale: costruito dopo aver scelto gli esercizi
  principali, in base ai movement pattern e ai muscoli che la sessione userà
  davvero, non da una tabella fissa per split
- [FACT] Anteprima, salvataggio, avvio, runner con timer di recupero, storico
- [FACT] Motore Forza (`src/generators/strength.ts`, nuovo): 6 split
  (Push/Pull/Legs, Upper/Lower, Full Body — niente Bro Split o Front/Back,
  convenzioni da ipertrofia). Struttura sempre 3 alzate pesanti + fino a 2
  accessori secondo il tempo, ripetizioni 3-8, recupero mai sotto i 90
  secondi. Riusa richiami settimanali ed esercizi preferiti dello stesso
  modulo di Bodybuilding, con un solo richiamo per sessione invece di due
- [FACT] Campo **Intensità** (Bassa/Media/Alta), scelto per sessione o di
  default in Profilo: sposta ripetizioni e recupero dentro l'intervallo
  dell'obiettivo, non lo cambia. Un principiante non arriva alle ripetizioni
  più basse nemmeno chiedendo "Alta" (sez. 16 del master prompt)
- [FACT] **Istruzioni testuali** per tutti i 118 esercizi (colonna
  `instructions` in Supabase), mostrate in anteprima e nel runner
- [FACT] **Stima calorie attive** (`src/generators/calories.ts`), formula MET
  standard, sempre etichettata come stima. Con peso utente non impostato usa
  una media adulta dichiarata (75 kg), mai spacciata per un dato preciso
  (sez. 60, regola 15 del master prompt)
- [FACT] Placeholder frequenza cardiaca ("FC non disponibile") nel runner:
  nessuna connessione hardware finta, come richiesto dalla sez. 84 — l'unico
  altro generatore reale della specifica (Base44) fa la stessa cosa
- [FACT] Motore **CrossFit Standard** (`src/generators/crossfit.ts`, nuovo,
  fase 6): struttura fissa Riscaldamento → Forza/Skill (1-2 alzate, riusa il
  tag `roles: 'strength'` del catalogo, scende a un compound non-conditioning
  equivalente se manca il bilanciere) → Metcon AMRAP (3-4 movimenti
  bodyweight/kettlebell/manubri/cardio, uno per categoria: monostrutturale,
  gambe, spinta/tirata, core). `GeneratedWorkout.split` è `null` per questa
  modalità: non ha uno split per gruppo muscolare
- [FACT] 8 nuovi esercizi in Supabase per il Metcon (87 totali): burpee,
  mountain climber, swing/thruster con kettlebell, thruster con manubri,
  step-up su rialzo, vogatore, sit-up — tutti taggati `conditioning` o
  `cardio`, mai sovrapposti al catalogo `strength`/`hypertrophy` esistente
- [FACT] Runner esteso per il Metcon: dopo la parte Forza/Skill, uno stopwatch
  a conto alla rovescia (il tempo dell'AMRAP) con un contatore di giri
  completati, invece del ciclo serie+recupero usato da Bodybuilding/Forza
- [FACT] Motore **CrossFit Hybrid** (`src/generators/hybrid.ts`): tre blocchi
  distinti, warm-up → Bodybuilding → Metcon. Il Metcon alterna cardio e
  isolamenti bodybuilding a carico controllato e supporta AMRAP, EMOM,
  For Time e Intervals. Nei programmi misti le sessioni A/B usano AMRAP/EMOM.
- [FACT] Motore **Condizionamento** (`src/generators/conditioning.ts`, nuovo,
  fase 8): solo Riscaldamento + Metcon, formato scelto dall'utente fra
  AMRAP, EMOM, For Time, Rounds, Circuit, Intervals — la vera "scelta di
  formato" della specifica, che CrossFit Standard non offre di proposito.
  Riusa lo stesso pool di movimenti di CrossFit Standard; cambia solo come
  li prescrive (tempo/round/intervalli) in base al formato
- [FACT] Motore **Tabata** (`src/generators/tabata.ts`, nuovo, fase 9):
  protocollo fisso 20″ lavoro/10″ riposo × 8 round, 1-4 movimenti in
  sequenza (mai round-robin fra movimenti come EMOM/Intervals: tutti gli 8
  round di un movimento, poi il successivo). Reps sempre `"max"`, non un
  numero fisso: è così che funziona davvero il protocollo
- [FACT] `shared.ts` guadagna le utilità comuni ai quattro motori "da
  Metcon" (`poolMetcon`, `costruisciCircuito`, `CATEGORIA_PATTERN`,
  `repsMetcon`, `scegliCandidato`): CrossFit Standard è stato rifattorizzato
  per usarle invece di duplicarle, prima di scrivere Hybrid/Condizionamento/
  Tabata sopra la stessa base
- [FACT] `GeneratedWorkout.split` è `Split | null`; `WorkoutBlock` guadagna
  `rounds` e `interval_sec` oltre a `format`/`time_cap_min` già esistenti,
  per rappresentare EMOM/Rounds/Circuit/Intervals/Tabata oltre ad AMRAP
- [FACT] Runner esteso con due nuove famiglie di UI per il Metcon, oltre
  all'AMRAP già esistente: uno stopwatch "a giri" che conta in avanti (For
  Time/Rounds/Circuit, con contatore giri) e un timer "a intervalli" che
  alterna lavoro/riposo da solo, round dopo round (EMOM/Intervals/Tabata,
  con l'indicizzazione del movimento round-robin per EMOM/Intervals ma
  sequenziale-per-movimento per Tabata, sez. 8)
- [FACT] 94 test automatici (`npm test`): 23 su Bodybuilding, 13 su Forza, 16
  su CrossFit Standard, 12 su CrossFit Hybrid, 19 su Condizionamento, 11 su
  Tabata, eseguiti contro il catalogo reale di 87 esercizi (fixture copiata
  da Supabase, non dati inventati)
- [FACT] Phase 2 riallineata al master prompt: `Exercise` distingue ora categoria,
  tipi dell'esercizio e ruoli nel workout; include nome inglese, sicurezza Metcon,
  rilevanza per il warm-up, descrizione e sostituzioni. I record legacy vengono
  completati da `src/data/exercises/normalize.ts`, così il frontend resta
  compatibile prima dell'applicazione della migrazione remota.
- [FACT] Migrazione versionata
  `supabase/migrations/20260806101337_exercise_catalog_v2.sql`: aggiunge e popola
  i metadati, impone vincoli, abilita RLS, concede solo la lettura necessaria agli
  utenti autenticati e aggiunge l'indice parziale del catalogo attivo.
- [FACT] 97 test automatici totali; build TypeScript/Vite verde.
- [FACT] Phase 3 verificata contro il master prompt: tutte le strutture
  Bodybuilding, compreso il Pull critico, sono già coperte dai test e non hanno
  richiesto una riscrittura.
- [FACT] Phase 4: il Weak Point Engine registra ora anche l'ultimo allenamento
  diretto o indiretto per muscolo e impedisce richiami aggiuntivi nelle 48 ore
  successive. Il volume considera tutti i blocchi non-warm-up, incluso il
  Metcon, e non soltanto il primo blocco `main`.
- [FACT] 100 test automatici totali; build TypeScript/Vite verde.
- [FACT] Phase 5: Equipment Engine granulare con 15 voci (pesi, macchine,
  cavi, cardio e accessori specifici). Tutti i generatori usano lo stesso
  controllo centralizzato; Profilo e impostazioni di oggi consentono di
  modificare l'inventario. I record legacy ricevono requisiti specifici per
  Row Erg, tapis roulant, cyclette, corda, sbarra, parallele, box ed elastici.
- [FACT] Migrazione `advanced_equipment` pronta: aggiunge
  `exercises.required_equipment` e `user_settings.available_equipment`.
- [FACT] 103 test automatici totali; build TypeScript/Vite verde.
- [FACT] Phase 6 riallineata: CrossFit Standard supporta AMRAP, For Time,
  EMOM, Rounds For Time, Chipper, Ladder e Intervals. La scelta è disponibile
  nella schermata Crea; Strength/Skill resta un blocco distinto dal Metcon e
  Rigenera conserva il formato. Chipper/Ladder riusano il runner a giri,
  EMOM/Intervals il runner a intervalli.
- [FACT] 111 test automatici totali; build TypeScript/Vite verde.
- [FACT] Phase 7 riallineata: CrossFit Hybrid ha ora tre blocchi distinti
  (warm-up, Strength/Bodybuilding, Hybrid AMRAP). Nel Metcon movimenti cardio
  e isolamenti si alternano; gli isolamenti sono ammessi solo con complessità
  tecnica 1, fatica sistemica 1 e presa al massimo 2.
- [FACT] 112 test automatici totali; build TypeScript/Vite verde.

## 4. Cosa è in lavorazione

Riallineamento sequenziale al master prompt richiesto dall'utente. Le Phase 2-7
sono completate; la Phase 8 è stata verificata contro i requisiti conservati in
questo repository senza richiedere modifiche. Il master prompt originale di 100
sezioni non è presente nel workspace, quindi un confronto testuale ulteriore
richiede che venga nuovamente fornito. Le migrazioni Phase 2/5, dati fisici,
configurazione dei workout salvati e contratto/RLS del profilo sono applicate
al database remoto. Tutte le 14 versioni risultano allineate fra locale e remoto.

## 5. Cosa manca

Validatore come modulo separato per le modalità Metcon (per Bodybuilding e
Forza la validazione è già integrata nella generazione, vedi sez. 8; i
quattro motori Metcon seguono lo stesso schema — struttura garantita a
priori, non scoperta dopo). Frequenza cardiaca reale (Bluetooth/HealthKit/
Health Connect): solo il placeholder onesto esiste, non l'architettura
`HealthDataProvider` della sez. 56. Integrazioni wearable, notifiche (tutto
rimandato a V1.2/V2 nella roadmap originale). Modifica di un workout salvato
esercizio per esercizio (sez. 45 della specifica): oggi si può solo
rigenerare o eliminare, non editare i singoli esercizi. Packaging mobile con
Capacitor (fase 14): implementato ma non ancora completato end-to-end; il nuovo
workflow APK richiede la correzione documentata nella sez. 10.

---

## 6. Problemi aperti

| # | Problema | Da quando | Cosa si è già provato |
|---|---|---|---|
| 4 | Verifica end-to-end autenticata incompleta: pagina pubblica e configurazione sono verificate, ma login→generazione→salvataggio richiede un account di test | 06/08 | Deployment, HTTP 200, rendering browser e presenza delle variabili verificati; non è stato creato un utente persistente fittizio |

## 7. Problemi risolti

> Non cancellare mai questa sezione: impedisce di rifare lo stesso errore.

| Problema | Causa vera | Soluzione |
|---|---|---|
| Spalle e braccia carenti venivano forzate anche in sedute biomeccanicamente estranee come Legs | Il generatore riceveva l'intero elenco globale delle carenze per ogni giorno e cercava di soddisfarlo localmente, senza sapere quale sistema settimanale fosse stato scelto | Il Weekly Engine assegna a ogni sessione solo le priorità compatibili con PPL, Upper/Lower, Front/Back o Bro Split. I richiami fuori split scendono a due serie e la seduta non supera sei esercizi |
| Legs poteva iniziare con Affondo bulgaro e il gluteo finiva dopo gli isolamenti | Il selettore ordinava i compound quasi solo per fatica sistemica e poi pescava fra i primi tre, senza distinguere pattern bilaterali stabili da affondi unilaterali; gli extra erano accodati senza un ordine esecutivo | Separata la scelta della variante dall'ordine esecutivo: squat/pressa prima degli affondi, catena posteriore seconda, glutei terzi, poi isolamenti e polpacci. Push riceve un ordinamento analogo fatigue-aware |
| I bip finali erano poco percepibili e mancava la vibrazione | Il warning Web Audio durava 70 ms con gain basso e oscillatore sinusoidale; non esisteva uso della Vibration API | Beep 3–2–1 più netto con oscillatore square e gain maggiore, vibrazione configurabile per warning/transizioni/fine dove il browser la supporta |
| Il salvataggio del Profilo restituiva HTTP 400 su `profiles?on_conflict=user_id` | La tabella conservava `id` come PK obbligatoria, mentre il client inviava soltanto `user_id`; inoltre il trigger di registrazione valorizzava soltanto la chiave legacy | Il client invia entrambe le chiavi, il trigger crea `id=user_id`, i record esistenti sono riallineati e `user_id` è NOT NULL. Rimosse le policy legacy duplicate basate su `id` |
| Le cinque migrazioni locali avanzate non erano applicabili al Supabase remoto | Un `SUPABASE_ACCESS_TOKEN` obsoleto del Codespace prevaleva sulle credenziali CLI; inoltre nove migrazioni già applicate al remoto mancavano dalla cartella locale | Escluso il token obsoleto, autenticata la CLI via browser, importate in sicurezza le nove migrazioni storiche e applicate le cinque pendenti. Verificati storico 14/14, colonne, 87 esercizi completi, policy profilo e advisor sicurezza |
| L'advisor Supabase segnalava `handle_new_user` come funzione `SECURITY DEFINER` richiamabile via API da chiunque | Le funzioni nello schema `public` sono esposte come endpoint RPC anche quando servono solo a un trigger | `revoke execute` su `anon`, `authenticated` e `public` per entrambe le funzioni di trigger. Migrazione `blinda_funzione_trigger` |
| Bodybuilding Push generava a volte solo 3-4 esercizi nonostante il minimo dichiarato di 5, e il messaggio all'utente era scoperto solo *dopo* la generazione | Il motore selezionava gli esercizi slot per slot e, se uno slot non trovava candidati, lo saltava semplicemente (`continue`); un ciclo di "riempimento" separato provava a rimediare ma si fermava appena finiva il budget di tempo. La struttura della sessione non era mai garantita a priori | Riscritto il motore con architettura "struttura-prima" (sez. 8 sotto): 5 slot base sempre presenti, 6°-7° decisi da richiami/extra, e un adattamento al tempo che riduce prima recuperi poi serie *prima* di togliere uno slot — mai sotto 5 se non per assenza reale di attrezzatura compatibile |
| I muscoli carenti venivano ridistribuiti nella sessione ma potevano far collassare un altro muscolo target: con carenze `biceps`+`rear_delts` su uno split Pull, il dorso scendeva da 3 slot a 1 | `ridistribuisci()` toglieva uno slot al muscolo più rappresentato per OGNI muscolo prioritario, anche quando quel muscolo prioritario aveva già un suo slot naturale: due priorità in sequenza "spolpavano" lo stesso donatore (`back`) due volte | La funzione ora salta i muscoli prioritari già rappresentati nello split: la redistribuzione serve solo a colmare un vuoto, non a gonfiare un muscolo già coperto. Trovato e verificato con un test sullo scenario critico della correzione (sez. 28 del prompt di correzione) |
| Gli esercizi preferiti aumentavano la probabilità di essere scelti solo da ~1/3 a ~1/3 (nessun effetto reale) | Il preferito veniva messo in cima all'ordinamento ma poi la scelta finale pescava comunque a caso fra i primi 3 candidati, preferito incluso: l'ordinamento non cambiava le probabilità | Quando esiste almeno un candidato preferito compatibile con lo slot, il pool di scelta si restringe ai soli preferiti (con varietà se l'utente ne ha più di uno per lo stesso muscolo), invece di un pool misto pescato a caso |
| Con carenze dichiarate su muscoli non pertinenti (es. bicipiti/tricipiti/deltoidi anteriori su uno split Gambe), quei muscoli comparivano comunque come "richiamo" nella sessione Gambe | Il calcolo dei richiami settimanali (`decidiRichiami`) operava su tutti i `priority_muscles` dell'utente senza filtrarli per split: bastava un volume settimanale basso (es. 0 per un utente nuovo) perché finissero in sessione, contro la regola esplicita "non aggiungere mai braccia o spalle nelle gambe" | Aggiunta una mappa `RICHIAMO_POOL` per split: le gambe possono richiamare solo quadricipiti/femorali/glutei/polpacci/core; Push e Pull hanno l'eccezione anatomica classica (Push può richiamare bicipiti, Pull può richiamare tricipiti), tutti gli altri split restano dentro il proprio pool naturale |
| Il tetto ai "compound pesanti" (max 2 a sessione, sez. 24/77 della correzione) non scattava mai nei test | La soglia era tarata su una scala di fatica 1-10 ("systemic_fatigue >= 7"), ma il catalogo reale usa una scala 1-3. Nessun esercizio raggiungeva mai la soglia | Soglia corretta a 3 (il valore massimo reale nel catalogo). Lezione: quando si tara una soglia su un campo numerico, controllare il range effettivo dei dati prima di scegliere il numero, non assumerlo dalla specifica in astratto |
| `AIOS_PROJECT.json`/`AIOS_STATE.md` dicevano che il collegamento automatico GitHub→Vercel non era attivo | La nota risale alla Fase 1 e non è mai stata riverificata nelle sessioni successive: è rimasta come vera per inerzia. In realtà il progetto Vercel *era* collegato a GitHub (dominio `gymbuilder-git-main-...` generato automaticamente, deployment innescato da solo dopo un push su `main`) | Verificato guardando l'elenco dei deployment su Vercel dopo un push reale: il nuovo commit compare come "Latest"/"Current" entro un minuto. Nota corretta in questo file. Lezione: una nota "problema aperto" scritta in una sessione va riverificata prima di darla per scontata nelle successive, non solo copiata avanti |
| Con intensità "Alta" e poco tempo a disposizione, il recupero finiva identico a quello di intensità "Bassa" nello stesso scenario — il campo Intensità sembrava non avere alcun effetto | Non è un bug: quando il tempo è troppo poco per il recupero lungo richiesto da "Alta", l'adattamento al tempo lo comprime verso il minimo, esattamente come farebbe con qualunque altra intensità nello stesso vincolo. È l'effetto atteso di "adatta il tempo, non tagliare esercizi", solo che in quel caso specifico appiattisce la differenza fra intensità | Non è stato cambiato il motore: cambiato il test, che ora verifica l'effetto dell'intensità con un budget di tempo sufficiente a non farla comprimere. Da tenere a mente: l'intensità è un'indicazione, non una garanzia, quando il tempo è troppo poco |
| Il dip di Push tornava a essere scelto a caso fra `dip_parallele` (corretto: allena anche petto/deltoide anteriore) e `dip_panca` (che non lo fa), nonostante il fix del 19/08 mattina | Il fix del 19/08 aveva ammesso `horizontal_push` a livello di intero muscolo tricipiti, non del singolo slot: entrambi gli esercizi passavano il filtro e la scelta finale restava un sorteggio fra i primi candidati | Aggiunto `preferredPatterns: ['horizontal_push']` sullo slot 4 di `BASE_SLOTS.push`: nel catalogo solo `dip_parallele` ha quel pattern esatto, quindi lo slot ora sceglie sempre e solo lui. Aggiunto anche `maxSets: 3` sullo stesso slot (prima 4) |
| Salvando una giornata dentro un programma settimanale multi-giorno, non c'era modo di tornare alla settimana in corso | Il modal "Allenamento Salvato!" aveva solo due uscite (Libreria, Home), nessuna verso `weeklyProgram` | Aggiunto un pulsante "Torna alla Settimana" (in cima alla pagina e nel modal), visibile solo quando `weeklyProgram.config.program_kind === 'program'` e `week.length > 1` |
| In Condizionamento, i movimenti monostrutturali (es. "1 min" al vogatore) diventavano "5" ripetizioni nei formati EMOM/For Time dopo la riduzione/aumento delle reps | `reduxReps()` usava `parseInt("1 min")`, che in JavaScript non restituisce `NaN` ma `1` (legge le cifre iniziali e ignora il resto): la stringa veniva trattata come un numero valido e riscalata a un valore senza senso | Aggiunta una guardia esplicita `/^\d+$/.test(reps)` prima di qualunque trasformazione numerica: le reps a tempo restano intatte. Trovato eseguendo davvero il motore su tutti e 6 i formati prima di scrivere i test (non solo `tsc`/build), esattamente la lezione già in sez. 9 |
| In Condizionamento, la `duration_min` finale dei formati "Rounds"/"Circuit"/"Intervals" era platealmente troppo corta (es. 5 minuti per 4 movimenti × 5 giri) | Il calcolo trattava ogni round come se durasse sempre 60 secondi (`rounds × 1 min`), formula presa in prestito da EMOM dove è vera per costruzione (`interval_sec` sempre 60) ma falsa per formati senza un `interval_sec` esplicito, dove un giro dura quanto il circuito reale richiede | `costruisciBlocco()` ora calcola e restituisce i minuti reali per formato (stima ~45s di lavoro a movimento + il recupero effettivo fra un esercizio e l'altro), invece di dedurli a ritroso da `rounds`/`interval_sec` al chiamante. Stessa lezione di sopra: il bug non sarebbe mai emerso da `tsc`/build, solo eseguendo il motore e leggendo i numeri prodotti |
| L'app poteva ancora chiudersi durante l'allenamento (schermo spento, dopo un cambio di fase come lavoro→riposo) nonostante il fix precedente del 17/08 (`a125bd8`, try/catch su `onStartCommand`) | Quel fix intercetta solo le `RuntimeException` sincrone dentro `onStartCommand()`. Il ramo `deadline <= now` chiamava `stopTimer()` senza mai chiamare `startForeground()` — ma il servizio è avviato con `startForegroundService()`, che impone `startForeground()` entro pochi secondi *da ogni esito*. Se non arriva, Android lancia `ForegroundServiceDidNotStartInTimeException` *dopo* che `onStartCommand()` è già tornato: un crash a livello di sistema che nessun try/catch Java/JS può intercettare. Un deadline già scaduto arriva quando il tick React che lo calcola gira in ritardo (throttling in background/schermo spento) | Aggiunta `promoteToForegroundThenStop()`: il ramo del deadline scaduto ora chiama comunque `startForeground()` (con una notifica "a zero secondi") prima di fermare il servizio, rispettando il contratto Android in ogni ramo. Non riproducibile in questo Codespace (niente Android SDK): individuato per lettura del contratto `startForegroundService`, non da un log di crash reale — da confermare su un telefono vero |

---

## 8. Decisioni prese

- **Il motore di generazione sarà deterministico, non un LLM** — motivo: è un
  requisito esplicito della specifica (sez. 37); un generatore che dipende da un
  modello non è verificabile né riproducibile — 05/08
- **Due file di memoria invece dei 17 documenti chiesti dalla specifica
  (sez. 63-74)** — motivo: coprono la stessa esigenza; diciassette file separati
  si contraddicono dopo poche sessioni e nessuno li aggiorna tutti. Le sezioni
  63-74 della specifica sono da considerarsi sostituite dal protocollo AI-OS — 05/08
- **La fase 1 unisce i punti 1, 2, 3 e 5 della sez. 96** (fondamenta, Supabase,
  schema, impostazioni utente) — motivo: prese singolarmente non sono verificabili
  aprendo un link; insieme producono qualcosa che l'utente può davvero usare — 05/08
- **Etichette dell'interfaccia in italiano, raccolte in `src/types/index.ts`** —
  motivo: l'utente è italiano, e tenerle fuori dai componenti rispetta la sez. 87
  (nessuna logica di dominio dentro la UI) — 05/08
- **Le schermate non ancora costruite dichiarano quale fase le porterà**, invece
  di mostrare pulsanti inerti — motivo: regola del protocollo AI-OS — 05/08
- **Il motore Bodybuilding decide la struttura della sessione (5-7 slot) PRIMA
  di scegliere gli esercizi**, non il contrario — motivo: era la causa vera dei
  workout troppo corti; il validatore deve essere una rete di sicurezza finale
  che corregge, non il punto in cui si scopre il problema (richiesta esplicita
  del prompt di correzione, sez. 2) — 05/08
- **I richiami sui muscoli carenti si basano sul volume settimanale stimato
  dagli allenamenti COMPLETATI negli ultimi 7 giorni**, non su una regola fissa
  "aggiungi sempre un esercizio per ogni carenza" — motivo: la specifica lo
  richiede esplicitamente (sez. 6-10 della correzione); è una periodizzazione
  volutamente semplificata (contatore mobile, non vera programmazione
  multi-settimana) e va trattata come tale in futuro — 05/08
- **Volume indiretto = metà del volume diretto** (`weakPoints.ts`) — motivo:
  euristica dichiarata, non letteratura scientifica; è un compromesso
  ragionevole per non ignorare del tutto lo stimolo secondario di un esercizio
  compound, va rivista se in futuro si aggiunge dato reale sull'efficacia — 05/08
- **13 split invece di 6**: aggiunti Bro Split (Petto/Dorso/Spalle/Braccia/
  Gambe) e Front/Back, richiesti esplicitamente dalla correzione (sez. 12-14).
  "Front"/"Back" sono etichettati in italiano come "Anteriore"/"Posteriore" per
  coerenza con il resto dell'interfaccia (sez. 8 del master prompt: tutta
  l'app in italiano) — 05/08
- **Non creati i 20 file di documentazione richiesti dal prompt di correzione
  (README/PROJECT_OVERVIEW/AI_CONTEXT/ARCHITECTURE/WORKOUT_ENGINE/...)** —
  motivo: è la stessa richiesta della specifica originale sez. 63-74, già
  sostituita dal protocollo AI-OS il 05/08 (vedi decisione sopra). Questo
  aggiornamento di `AIOS_STATE.md` copre gli stessi contenuti (regole del
  motore, decisioni, problemi trovati/risolti, prossimi passi) in un posto
  solo — 05/08
- **Test automatici (vitest) aggiunti solo per i motori di generazione**, non
  per l'intera app — motivo: sono l'unica parte con logica di dominio complessa
  abbastanza da rompersi silenziosamente (i bug trovati in questa e nella
  sessione precedente erano tutti invisibili leggendo il codice, emersi solo
  eseguendo i test contro il catalogo reale); UI e pagine restano verificate
  a mano com'era finora — 05/08
- **Forza è un motore proprio (`strength.ts`), non Bodybuilding con l'obiettivo
  "forza" e meno serie** — motivo: struttura diversa (3 alzate pesanti fisse
  contro 5 slot variabili), niente Bro Split/Front-Back, recupero minimo più
  alto (90s contro 45s), un solo richiamo settimanale invece di due. Condivide
  però `shared.ts`/`weakPoints.ts`/`calories.ts` con Bodybuilding: la parte
  davvero identica (timer, riscaldamento contestuale, dedup, richiami) non va
  duplicata, solo le regole di programmazione restano separate per motore — 05/08
- **Le modalità non ancora costruite (CrossFit Standard/Hybrid, Tabata,
  Condizionamento) compaiono nella UI come riquadri disattivati con
  "in arrivo"**, non nascoste e non cliccabili come se funzionassero —
  motivo: regola esplicita sez. 84, "non fingere che una funzionalità esista" — 05/08
- **L'intensità (Bassa/Media/Alta) sposta l'intervallo di ripetizioni/recupero
  dentro l'obiettivo già scelto, non lo sostituisce** — motivo: nella UI di
  riferimento (Base44) è un campo distinto da Obiettivo; trattarlo come un
  moltiplicatore del recupero (0.75×/1×/1.25× in Bodybuilding, un intervallo
  di reps dedicato in Forza) lo rende utile senza reinventare la prescrizione — 05/08
- **Le istruzioni per esercizio sono una riga sola, non un paragrafo** —
  motivo: coerenza con l'esempio di riferimento (Base44) e con l'uso reale:
  vanno lette in pochi secondi durante l'allenamento, non studiate prima — 05/08
- **La stima calorie usa un peso di default (75 kg) se l'utente non lo imposta**,
  invece di nascondere del tutto la stima — motivo: mostrare comunque un numero
  onestamente etichettato come stima è più utile di non mostrare nulla, purché
  non si dica mai che è un valore preciso (sez. 82, regola 15 del master prompt).
  Il peso in Profilo resta facoltativo — 05/08
- **CrossFit Standard usa solo il formato AMRAP per il Metcon**, non tutti
  quelli citati dalla specifica (EMOM/For Time/Rounds/Circuit/Intervals) —
  motivo: quei formati sono la differenza esplicita del futuro motore
  Condizionamento (fase 8); anticiparli qui avrebbe reso le due modalità
  indistinguibili quando arriverà. AMRAP è il più classico di una classe
  standard e il più semplice da eseguire con un solo timer — 06/08
- **Il Forza/Skill di CrossFit Standard non usa la programmazione settimanale
  sui muscoli carenti** (`weakPoints.ts`) come Bodybuilding/Forza — motivo:
  con solo 1-2 alzate per sessione non è un contesto in cui il volume
  settimanale ha senso; `priority_muscles` resta usato ma solo come
  spareggio nella scelta del pattern (squat/hinge vs push/pull), non come
  richiamo aggiuntivo — 06/08
- **La sessione CrossFit Standard ha un tetto reale (~47 minuti: 9 di
  riscaldamento, fino a 18 di Forza/Skill, fino a 20 di Metcon) anche
  scegliendo 90 minuti**, con un avviso esplicito quando succede — motivo:
  una classe CrossFit non si allunga solo perché l'utente ha più tempo
  libero, è la durata tipica del formato (sez. 82, mai un dato taciuto
  silenziosamente) — 06/08
- **Il Metcon pesca solo movimenti bodyweight/kettlebell/manubri/cardio
  (mai bilanciere, macchine o cavi)**, presi dal catalogo con tag
  `conditioning`/`cardio` — motivo: tiene la parte Metcon nettamente
  separata dalla parte Forza/Skill (nessuna sovrapposizione di esercizi fra
  i due blocchi) e replica la reale distinzione CrossFit fra alzate pesanti
  e movimenti funzionali ad alta ripetizione. Aggiunti 8 esercizi al
  catalogo per coprire la categoria (burpee, mountain climber, kettlebell
  swing/thruster, dumbbell thruster, box step-up, vogatore, sit-up), perché
  il catalogo esistente (pensato per Bodybuilding/Forza) non ne aveva
  a sufficienza — 06/08
- **Il Forza/Skill scende a un compound non-conditioning equivalente se
  l'attrezzatura non consente bilanciere** (es. goblet squat, piegamenti),
  invece di lasciare il blocco vuoto — motivo: stessa regola sez. 84, non un
  buco silenzioso quando l'utente ha solo manubri o corpo libero — 06/08
- **[SUPERATO] CrossFit Hybrid era un unico blocco `kind: 'main'` con esercizi alternati
  compound/metcon, non un blocco Metcon separato** — motivo: la sequenza
  ordinata sets/reps/rest che Bodybuilding/Forza già usano rappresenta
  perfettamente "un'alzata, poi una scarica cardio" senza inventare niente
  di nuovo nel modello dati; il Runner esistente la esegue già così com'è,
  zero modifiche — decisione del 06/08, superata dal riallineamento successivo
- **Hybrid non usa la programmazione settimanale sui muscoli carenti**
  (`weakPoints.ts`), a differenza di Bodybuilding/Forza — motivo: la
  rotazione tocca già tutto il corpo ad ogni sessione per costruzione, a
  differenza di uno split che lascia scoperti dei muscoli in certi giorni;
  `priority_muscles` resta usato solo per ordinare le coppie — 06/08
- **Condizionamento è l'unico motore dove il formato del Metcon è una vera
  scelta dell'utente** (AMRAP/EMOM/For Time/Rounds/Circuit/Intervals) —
  motivo: è la sua differenza esplicita dalla specifica rispetto a CrossFit
  Standard (AMRAP fisso) e Tabata (protocollo fisso), altrimenti le tre
  modalità si sovrapporrebbero senza motivo — 06/08
- **Tabata ha un motore proprio invece di essere "solo un altro formato" di
  Condizionamento** — motivo: la prescrizione è rigida (20″/10″×8, sempre),
  non è mai stata una vera scelta come gli altri sei formati; trattarla come
  settima opzione in `FORMATI_CONDIZIONAMENTO` avrebbe reso disponibile una
  scelta che in realtà non esiste — 06/08
- **In Tabata i movimenti multipli sono sequenziali (tutti gli 8 round del
  primo, poi il secondo), mai round-robin come EMOM/Intervals** — motivo: è
  così che funziona davvero il protocollo classico; interlacciare i
  movimenti round per round avrebbe dato a ciascuno solo una frazione degli
  8 round richiesti, tradendo il nome "Tabata". Il Runner distingue i due
  comportamenti con un solo branch esplicito su `format === 'tabata'`,
  condividendo il resto della UI a intervalli con EMOM/Intervals — 06/08
- **La scelta dei movimenti da Metcon (`poolMetcon`/`costruisciCircuito` in
  `shared.ts`) è condivisa da tutti e quattro i motori Metcon**, CrossFit
  Standard rifattorizzato per usarla prima di scrivere gli altri tre sopra
  la stessa base — motivo: la logica "bodyweight/kettlebell/manubri/cardio,
  una categoria alla volta, completa da quel che resta se una categoria è
  vuota" è identica in tutti e quattro; solo la prescrizione (tempo, round,
  reps) cambia motore per motore — 06/08
- **Ogni motore Metcon ha un tetto di durata realistico, non proporzionale
  al tempo scelto dall'utente**, con un avviso esplicito quando la sessione
  resta più corta del richiesto — motivo: stessa filosofia già applicata a
  CrossFit Standard (sez. precedente), estesa a Hybrid/Condizionamento/
  Tabata: un formato Metcon non diventa più lungo solo perché c'è più tempo
  libero, è la natura del formato, non un limite tecnico — 06/08

---

## 9. Trappole di questo progetto

- La chiave `VITE_SUPABASE_ANON_KEY` **non è un segreto**: è progettata per stare
  nel codice del browser e finisce comunque nel bundle. Ciò che protegge i dati
  sono le regole RLS, non la segretezza della chiave. Non allarmarsi vedendola nel
  bundle; allarmarsi invece se una tabella nuova nasce senza RLS
- **Ogni tabella nuova va creata con RLS attiva e le sue policy nella stessa
  migrazione.** Una tabella senza RLS in Supabase è leggibile da chiunque abbia la
  chiave pubblica, cioè da chiunque apra il sito
- **Ogni funzione nuova nello schema `public` è esposta come endpoint RPC.** Se
  serve solo a un trigger, va revocato l'`execute` (vedi problemi risolti)
- **Compilare non basta.** `tsc` e `vite build` non intercettano un errore che
  esplode solo a runtime. Dopo ogni modifica importante, aprire davvero il link
  pubblicato e provare il flusso, non fermarsi al "build riuscita"
- **Compilare non basta nemmeno per la logica del motore.** I tre bug corretti
  in questa sessione (sez. 7) type-checkavano tutti perfettamente: erano errori
  di logica, non di tipi. `npm test` esegue `src/generators/__tests__/` contro
  il catalogo reale — va lanciato dopo ogni modifica al motore, non solo la build
- **Le scale numeriche del catalogo esercizi (`technical_complexity`,
  `systemic_fatigue`, `local_fatigue`, `grip_fatigue`, `cardio_demand`) vanno
  da 1 a 3, non 1 a 10.** È facile assumere una scala più larga leggendo la
  specifica astratta (che parla di "fatica" senza numeri) invece di controllare
  i dati reali — è già successo una volta (soglia compound pesanti tarata a 7,
  mai raggiungibile). Controllare sempre `min`/`max` reali prima di tarare una soglia
- **`parseInt()` su una stringa tipo `"1 min"` non restituisce `NaN`, restituisce
  `1`.** Qualunque funzione che trasforma numericamente il campo `reps` (una
  stringa libera, non sempre un numero: può essere `"12-15"`, `"1 min"`,
  `"30-60 sec"`) deve controllare esplicitamente il formato prima di fare
  aritmetica, non fidarsi di un controllo `Number.isNaN` a valle — non lo
  intercetta. Bug reale trovato in Condizionamento (sez. 7), non ipotetico
- **Un motore che genera struttura corretta può comunque avere una `duration_min`
  completamente sbagliata** se il calcolo della durata è una formula generica
  scritta prima di sapere davvero quanto dura un formato, invece di essere
  derivata dai numeri che il motore ha appena costruito. Eseguire sempre il
  motore e leggere i numeri prodotti (non solo `tsc`/build/test strutturali)
  prima di considerarlo finito — stessa lezione della voce sopra, due bug
  diversi nello stesso motore nella stessa sessione
- **`package-lock.json` non è committato di proposito.** `npm install` lo
  rigenera in un attimo da `package.json`, e un lockfile di ~90KB nel diff
  costerebbe caro da spingere su GitHub tramite gli strumenti MCP disponibili
  in questo ambiente (niente `git push` diretto autenticato qui, solo API).
  Se in futuro serve pin esatto delle versioni, va aggiunto consapevolmente,
  non come effetto collaterale di un altro commit

---

## 10. Dove si è fermato l'ultimo lavoro

### Handoff corrente — build APK automatica

- [FACT] La build APK automatica è completata end-to-end. Il workflow
  `.github/workflows/build-apk.yml` parte sui push a `main`, ignora
  `public/gymbuilder.apk`, usa Node 24 e Java 21, riceve le variabili pubbliche
  Vite/Supabase, sincronizza Capacitor, compila l'APK debug, lo rinomina
  `public/gymbuilder.apk`, lo salva con `[skip ci]` e pubblica esplicitamente su
  Vercel tramite il secret GitHub `VERCEL_TOKEN`.
- [FACT] La prima esecuzione GitHub Actions (`32037095948`) ha superato checkout,
  installazione strumenti, `npm ci` e sincronizzazione Capacitor, ma la build si
  è fermata con exit code 126: `./gradlew: Permission denied`.
- [FACT] L'errore iniziale è stato risolto invocando `bash gradlew
  assembleDebug`. L'esecuzione definitiva `32037676638` è verde in 2m18s,
  inclusi Gradle, commit del bot e deploy Vercel. Commit workflow `65457ce`;
  commit APK del bot `5ec68a0`.
- [FACT] Il criterio di arrivo è verificato: nessun loop Actions e
  `https://gymbuilder-lemon.vercel.app/gymbuilder.apk` restituisce HTTP 200,
  `Content-Type: application/vnd.android.package-archive`, filename
  `gymbuilder.apk` e 8.190.529 byte.
- **Prossimo passo prodotto:** la build corrente è un APK debug. Per distribuire
  aggiornamenti Android affidabili agli utenti resta da firmare le release con
  la keystore definitiva e mantenere la stessa chiave per tutte le versioni.
- [FACT] Il file non tracciato `BB.txt` appartiene all'utente e deve restare
  intatto e fuori dai commit.

**Modello:** Claude (Sonnet 5) · **Data:** 2026-08-06 (sessione 2)

Costruite le fasi 7-9 in sequenza nella stessa sessione: **CrossFit Hybrid**
(`hybrid.ts`, forza+cardio alternati in un unico blocco `main`, nessuna UI
nuova necessaria), **Condizionamento** (`conditioning.ts`, solo Metcon con
formato scelto dall'utente fra sei) e **Tabata** (`tabata.ts`, protocollo
fisso). Prima di scriverli, `shared.ts` è stato esteso con le utilità comuni
ai motori Metcon (`poolMetcon`, `costruisciCircuito`, `CATEGORIA_PATTERN`,
`repsMetcon`) e CrossFit Standard rifattorizzato per usarle, per non
duplicare la stessa logica quattro volte. Il Runner è stato esteso con due
nuove famiglie di UI per il Metcon (stopwatch "a giri", timer "a
intervalli") oltre all'AMRAP già esistente. Trovati e corretti due bug reali
eseguendo davvero i motori (non solo build/tsc): reps a tempo corrotte da
`parseInt`, durata sballata per i formati senza `interval_sec` esplicito
(sez. 7, 9).

**Le sei modalità della specifica esistono tutte.** Il punto esatto in cui
riprendere è una delle fasi 10-14 rimaste aperte (sez. 11): modifica di un
salvato esercizio per esercizio, frequenza cardiaca reale, packaging
mobile.

**Pubblicato.** Il 06/08 l'ambiente disponeva di un token GitHub funzionante:
i commit locali e la configurazione ESLint sono stati inviati a `main`. Vercel
ha completato automaticamente il deployment di produzione; build, 112 test e
lint (zero errori, quattro avvisi non bloccanti) sono stati verificati prima del
push. Il blocco di pubblicazione delle sessioni precedenti è quindi risolto.

---

## 11. Prossimi passi

Le fasi seguono l'ordine della sez. 96 della specifica dell'utente, accorpate dove
prese singolarmente non sarebbero verificabili.

| Fase | Cosa | Stato |
|---|---|---|
| **2** | Database esercizi (87 voci) e modello completo/versionabile | ✅ Fatto nel repository; migrazione remota da applicare |
| **3** | Motore Bodybuilding: 13 split, fatica, muscoli prioritari | ✅ Verificato nella sessione 3 |
| **4** | Weak Point settimanali: volume diretto/indiretto, frequenza e recupero | ✅ Completato nella sessione 3 |
| **5** | Equipment Engine e attrezzatura avanzata | ✅ Completato nella sessione 3 |
| **6** | CrossFit Standard: Forza/Skill + 7 formati Metcon | ✅ Completato nella sessione 3 |
| **7** | CrossFit Hybrid: Strength separato + Metcon cardio/isolamento | ✅ Riallineato nella sessione 3 |
| **8** | Condizionamento: AMRAP, EMOM, For Time, Rounds, Circuit, Intervals | ✅ Fatto in questa sessione |
| **9** | Tabata, motore separato | ✅ Fatto in questa sessione |
| **10** | Workout Runner e timer | ✅ Fatto per tutte e sei le modalità: ciclo serie/recupero (Bodybuilding/Forza/CrossFit Standard Forza-Skill/Hybrid), stopwatch a giri (For Time/Rounds/Circuit), timer a intervalli (AMRAP/EMOM/Intervals/Tabata) |
| **11** | Salvataggio, preferiti, ripeti identico, rigenera variante | ✅ Salvataggio/rigenerazione fatti per tutte e sei le modalità. Modifica esercizio-per-esercizio di un salvato: non ancora |
| **12** | Storico e valutazione post-allenamento | ✅ Fatto (valutazione soggettiva + note; niente HR/calorie, rimandato a V1.2) |
| **13** | Test sulle parti critiche | 🟡 94 test su tutti e sei i motori di generazione (`npm test`). Da estendere se arrivano nuove regole |
| **14** | Preparazione all'impacchettamento mobile con Capacitor | 🟡 APK debug automatico online; resta la release firmata con keystore stabile (handoff sez. 10) |

---

## 12. Storico delle sessioni

| Data | Modello | Cosa è stato fatto |
|---|---|---|
| 2026-08-05 | Claude Opus 4.5 | Progetto creato da zero con AI-OS. Fase 1: fondamenta React+Vite+TS+Tailwind, Supabase con RLS, autenticazione, profilo e impostazioni persistenti, navigazione, pubblicazione su Vercel |
| 2026-08-05 | Claude Opus 4.5 | Fasi 2-3: database di 79 esercizi, motore Bodybuilding deterministico (6 split), anteprima, salvataggio, runner con timer di recupero, storico |
| 2026-08-05 | Claude (Sonnet 5) | Handoff: ricostruito lo stato reale del progetto (questo file era rimasto indietro di una sessione), verificata la build |
| 2026-08-05 | Claude (Sonnet 5) | Correzione del motore Bodybuilding su richiesta esplicita dell'utente: architettura riscritta da "genera poi valida" a "struttura prima, poi seleziona, poi adatta al tempo, poi valida come rete di sicurezza". Aggiunti richiami settimanali sui muscoli carenti (`weakPoints.ts`), esercizi preferiti realmente pesati, riscaldamento contestuale, 7 nuovi split (Bro Split ×5, Front/Back). Trovati e corretti 3 bug reali tramite 23 test automatici (vitest) eseguiti contro il catalogo reale di 79 esercizi: richiami che finivano su split sbagliati, redistribuzione che faceva collassare un muscolo target, preferiti senza effetto reale sulla probabilità di scelta. Pubblicato su GitHub tramite Codespaces (push diretto bloccato in questo ambiente) e verificato live su Vercel |
| 2026-08-05 | Claude (Sonnet 5) | Dopo un confronto con l'app di riferimento costruita con Base44, tre aggiunte UI (intensità, istruzioni per esercizio nel database, stima calorie attive con placeholder FC onesto) e costruzione del motore Forza (`strength.ts`, fase 5), che riusa `shared.ts`/`weakPoints.ts`/`calories.ts` invece di duplicare Bodybuilding. Aggiunte colonne `instructions` su `exercises` e `weight_kg`/`default_intensity` su `user_settings`. 13 nuovi test (36 totali). Corretta la nota obsoleta sul collegamento GitHub→Vercel, che in realtà funziona |
| 2026-08-06 | Claude (Sonnet 5) | Fase 6: motore CrossFit Standard (`crossfit.ts`) — Riscaldamento → Forza/Skill (riusa il tag `roles: 'strength'`, scende a un compound equivalente senza bilanciere) → Metcon AMRAP (3-4 movimenti bodyweight/kettlebell/manubri/cardio, uno per categoria). Solo formato AMRAP di proposito: EMOM/For Time/Rounds/Circuit/Intervals restano la differenza del futuro motore Condizionamento (fase 8). Aggiunti 8 esercizi al catalogo Supabase (87 totali: burpee, mountain climber, kettlebell swing/thruster, dumbbell thruster, box step-up, vogatore, sit-up). `GeneratedWorkout.split` diventato `Split \| null` (lo schema DB lo prevedeva già). Runner esteso con uno stopwatch AMRAP e un contatore di giri. 16 nuovi test (52 totali) |
| 2026-08-06 | Claude (Sonnet 5) | Fasi 7-9 in sequenza, su richiesta esplicita dell'utente di completare tutte e sei le modalità: **CrossFit Hybrid** (`hybrid.ts`, forza+cardio alternati in coppie dentro un unico blocco `main`, nessuna modalità nuova richiesta al Runner), **Condizionamento** (`conditioning.ts`, solo Metcon, formato scelto dall'utente fra AMRAP/EMOM/For Time/Rounds/Circuit/Intervals), **Tabata** (`tabata.ts`, protocollo fisso 20″/10″×8, sequenziale per movimento non round-robin). `shared.ts` esteso con le utilità comuni ai motori Metcon (`poolMetcon`, `costruisciCircuito`, `CATEGORIA_PATTERN`, `repsMetcon`) e CrossFit Standard rifattorizzato per usarle prima di scrivere gli altri tre. Runner esteso con due nuove famiglie di UI (stopwatch a giri, timer a intervalli) oltre all'AMRAP. Trovati e corretti 2 bug reali eseguendo i motori (non solo build): reps a tempo corrotte da `parseInt`, durata sballata nei formati senza `interval_sec`. 42 nuovi test (94 totali). **Non pubblicato**: il push resta bloccato da questo ambiente anche via API GitHub (non solo `git push`), consegnata una patch da applicare manualmente |
| 2026-08-06 | Codex | Ripreso il master prompt dalla Phase 2 mantenendo `AIOS_STATE.md`/`AIOS_PROJECT.json` come unica memoria ufficiale su decisione dell'utente. Esteso il modello Exercise con metadati canonici e separazione fra tipo e ruolo nel workout; aggiunta normalizzazione retrocompatibile; creata con Supabase CLI la migrazione `exercise_catalog_v2` con backfill, vincoli, RLS, grant esplicito e indice parziale. Aggiunti 3 test (97 totali), build verde. Migrazione remota ancora da applicare. |
| 2026-08-06 | Codex | Phase 3 verificata senza riscritture; Phase 4 completata. `analizzaSettimana` calcola volume diretto/indiretto su tutti i blocchi allenanti e ultima esposizione per muscolo; `decidiRichiami` applica 48 ore minime di recupero agli slot aggiuntivi. Flusso Create/Rigenera aggiornato. 100 test totali, build verde. |
| 2026-08-06 | Codex | Phase 5 completata: inventario granulare di 15 attrezzi, mapping retrocompatibile dai record Exercise legacy, filtro centralizzato usato da tutti i generatori, personalizzazione persistente nel Profilo e override per la sessione corrente. Migrazione `advanced_equipment`, 3 nuovi test, 103 totali, build verde. |
| 2026-08-06 | Codex | Phase 6 completata: CrossFit Standard esteso da AMRAP fisso a sette formati selezionabili (AMRAP, For Time, EMOM, Rounds For Time, Chipper, Ladder, Intervals), conservando il blocco Strength/Skill separato. UI, rigenerazione, modello e Runner riallineati; 111 test totali, build verde. |
| 2026-08-06 | Codex | Phase 7 riallineata: CrossFit Hybrid passa dal singolo blocco compound/cardio alternato a warm-up + Strength/Bodybuilding + Hybrid AMRAP. Il circuito alterna cardio e isolamenti filtrati per sicurezza sotto fatica. Aggiornati i test strutturali e di sicurezza; 112 test totali, build verde. |
| 2026-08-06 | Codex | Weekly Program Engine multi-modalità, recovery scoring esaustivo ed Exercise Feedback Engine pubblicati su `main` fino al commit `8344953`. 137 test verdi, build verde, Vercel produzione Ready; homepage HTTP 200 e bundle aggiornato verificato. Verifica autenticata completa ancora da eseguire con account di test. |
| 2026-08-06 | Codex | Correzione PPL con vincoli movement pattern, Profile contract `user_id` + migration RLS e Timer/Audio Engine unificato a timestamp. 149 test e build verdi; commit `64112ac` pubblicato e asset Vercel verificati HTTP 200. Migration remota e test audio mobile/autenticato restano da completare. |
| 2026-08-06 | Codex | Carenze Bodybuilding rese obbligatorie per seduta: un requisito spalle, uno bicipiti e uno tricipiti prima degli extra, con replacement semanticamente coerente anche fuori split. 153 test verdi; commit `e9bcc38` e produzione Vercel verificati HTTP 200. |
| 2026-08-07 | Codex | Aggiunti PWA/Service Worker, mini-timer globale, notifiche persistenti con deep-link al Runner e accesso all'allenamento locale durante errori rete/auth. Runner completato con Indietro, Pausa/Riprendi e Stop; eliminazione schede salvate resa esplicita e confermata. |
| 2026-08-07 | Codex | Livelli pubblici ridotti a Principiante/Avanzato; catalogo CrossFit remoto portato a 142 esercizi. Standard resta funzionale senza isolamenti, Hybrid apre con compound bilaterali, Forza usa 3 fondamentali + 2 complementari e le combinazioni BB+Forza/CrossFit+Forza hanno semantica distinta. |
| 2026-08-07 | Codex | Resa universale l'apertura compound: Bodybuilding, Forza e Hybrid spostano il primo multiarticolare davanti a isolamenti, richiami e carenze senza alterare l'ordine relativo degli slot successivi. |
| 2026-08-07 | Codex | Separato il completamento del countdown dagli avvisi 3–2–1: tre beep brevi seguiti da un segnale lungo configurabile (beep, ding, ring o sola vibrazione). |
| 2026-08-07 | Codex | Separata la priorità globale dalla prescrizione del singolo giorno: PPL resta sempre Bodybuilding/ipertrofia; Forza, CrossFit e Hybrid non vengono più presentati come varianti PPL miste o conditioning. |
| 2026-08-07 | Codex | Catalogo remoto curato a 141 esercizi attivi con zero cue generici/mancanti, nomi italiani dove naturali e termini tecnici preservati. Disattivata Leg Extension unilaterale duplicata; le schede salvate vengono idratate col catalogo corrente all'apertura. |
| 2026-08-07 | Codex | Separati definitivamente Programma e Sessione singola. BB+HY PPL 5 giorni conserva il blocco P/P/L-rest-HY specializzazione/HY functional-rest; le carenze sono distribuite su Push/Pull/HY A e non su Legs/HY B. Single session sceglie direttamente lo split e Bro Petto usa 2 compound + 3 isolamenti. |
| 2026-08-07 | Codex | Imposto il limite definitivo di due discipline per programma e una per sessione singola. Aggiunte metodiche dedicate Forza/CrossFit/Hybrid; Forza + CrossFit su sei giorni alterna tre sedute per disciplina e ogni CrossFit evita i gruppi affaticati dalla Forza precedente. 175 test verdi. |
| 2026-08-07 | Codex | Corretto il selettore grafico delle discipline: default solo Bodybuilding, griglia separata, riepilogo 1/2–2/2 e sostituzione automatica della seconda modalità. BB + Hybrid può diventare BB + CrossFit con un solo tocco e i pannelli metodologici seguono la selezione reale. 176 test verdi. |
| 2026-08-07 | Codex | Semplificato il configuratore alle sole scelte comprensibili dell’utente. Priorità, intensità e metodiche non sono più controlli pubblici: il motore le deduce da discipline, livello, durata, split, carenze e recupero. UI riorganizzata in schede; 177 test verdi. |
| 2026-08-07 | Codex | Reintrodotta la scelta metodologica esclusivamente nella sessione singola: Forza 5×5/3×5/massimale/complementari, sette formati CrossFit e focus/formato Hybrid. Il motore preserva la scelta manuale; i programmi restano automatici. 178 test verdi. |
| 2026-08-07 | Codex | Corretti test CrossFit: warning ripetuti aggregati, formati diversi assegnati alle giornate e istruzioni operative per tutti i WOD. Corda riclassificata monostrutturale: Single Under principiante e Double Under avanzato anche in Hybrid; catalogo remoto aggiornato. 188 test verdi. |
| 2026-08-12 | Antigravity | Completa la riprogettazione UI/UX Dark Glassmorphic (Fasi 1-5): Dashboard Home "Oggi", Navbar inferiore a 4 tab neon, Wizard "Crea" a 3 step con gesti swipe, Modal gratificante di salvataggio e Libreria Salvati con azioni 1-tap. 192 test verdi, 0 errori ESLint, build OK, pubblicato su Vercel. |
| 2026-08-12 | Codex | Corretto il resume del Runner durante background/riapertura: la sessione attiva salva e ripristina stato completo, countdown, deadline reali e avanzamento Tabata/Metcon senza ripartire da capo al ritorno su `/avvia`. Rimossa inoltre la devDependency Linux-only `@rolldown/binding-linux-x64-gnu`, che bloccava `npm install` su Windows. Verifica completata: 193 test verdi e build produzione riuscita. |
| 2026-08-12 | Codex | Introdotta una sessione attiva globale persistente nel `WorkoutContext`: Home, anteprima, salvati, `/avvia` e banner timer riaprono la stessa sessione invece di crearne una nuova. `public/sw.js` ora rifocalizza la finestra corretta e invia `RESUME_ACTIVE_SESSION`; la sincronizzazione fra istanze browser usa anche l'evento `storage`. Integrata la base Android con Capacitor (`android/`, `capacitor.config.ts`, script dedicati) configurata per caricare `https://gymbuilder-lemon.vercel.app`, cos? i deploy frontend aggiornano automaticamente l'app installata. Verifiche: test verdi, build verde, `cap:sync` riuscito; `assembleDebug` bloccato solo da Android SDK locale mancante (`ANDROID_HOME` / `sdk.dir`). |
| 2026-08-13 | Codex | Allineata la UX di creazione con un ingresso `fresh` che evita di riaprire una vecchia settimana quando l'utente vuole una nuova scheda. Corrette le sessioni singole Bodybuilding custom: 5-6 esercizi stabili, niente petto se non selezionato, muscoli carenti anticipati senza far sparire bicipiti/tricipiti. Ripristinati i pulsanti `Indietro` e `Stop/Elimina` nel Runner con conferma immediata. CrossFit Standard reso piu denso e distinto dal Bodybuilding con 4-5 movimenti Metcon e seconda alzata anticipata quando il tempo lo consente. Verifiche: 195 test verdi e build produzione OK. |
| 2026-08-13 | Codex | Aggiunta la possibilita di riaprire il wizard con `Modifica parametri` mantenendo la configurazione corrente come base reale di editing. Rafforzata la semantica dei muscoli carenti: nelle sessioni custom Bodybuilding i target non fanno piu fallback su muscoli non richiesti; in CrossFit Standard una carenza coerente viene richiamata nella parte Forza/Skill con carico ridotto; in Hybrid le carenze pesano meglio sia nei compound sia negli isolamenti/cardio del Metcon. Verifiche: 198 test verdi e build produzione OK. |
| 2026-08-13 | Codex | Verificato sul motore che `CrossFit Standard` genera gia un Metcon multi-movimento coerente con un WOD reale; il caso osservato con un solo esercizio e quindi da ricondurre al flusso app/dati e non al generatore puro. Riallineato `Hybrid` per evitare Metcon troppo poveri nelle sessioni brevi: ora a 30 minuti ha almeno 3 movimenti e da 45 minuti in su 4 movimenti, sempre in alternanza cardio/isolamento. Verifiche: 199 test verdi e build produzione OK. |
| 2026-08-13 | Codex | Corretto il filtro preferenze per i motori metabolici: `corpo libero = solo finisher` non filtra piu in anticipo i movimenti del WOD in `CrossFit`, `Hybrid` e `Tabata`, evitando Metcon impoveriti o quasi vuoti. Aggiunto anche il fallback sicuro per i record legacy senza `required_equipment`. Riprodotto il caso reale dell'utente su `CrossFit Standard` 60 minuti palestra completa: dopo il fix il blocco Metcon resta multi-movimento (5 esercizi). Verifiche: 201 test verdi e build produzione OK. |
| 2026-08-13 | Codex | Esteso il fallback del pool `Metcon`: quando mancano rower o kettlebell, i motori metabolici possono completare il WOD usando alternative monostrutturali/cardio valide dal warm-up pool come cyclette o tapis roulant. Riprodotto un caso senza `row_erg`, `kb_swing` e `kb_thruster`: `CrossFit Standard` mantiene comunque 5 movimenti nel Metcon. Verifiche: 202 test verdi e build produzione OK. |
## Aggiornamento stato — 2026-08-17: APK Android e auto-update

La base Capacitor esistente è stata completata con un sistema di aggiornamento nativo. `public/version.json` è il contratto remoto; React confronta la versione installata tramite il plugin `ApkUpdater`, mostra un modal e demanda download e installazione al sistema Android. Una nuova finestra di installazione viene aperta solo dopo un download HTTPS riuscito. Android richiede conferma esplicita e, al primo aggiornamento, il permesso per installare app sconosciute.

La CI `.github/workflows/android-ci.yml` compila un APK debug con Java 21 sulle modifiche native; `.github/workflows/android-release.yml` costruisce `GymBuilder.apk` sui tag `android-v*`. Prima della prima Release devono essere configurati `ANDROID_KEYSTORE_BASE64`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD` nei GitHub Actions Secrets. La stessa keystore deve essere conservata per tutte le versioni future. Finché `apkUrl` in `version.json` resta vuoto, il modal nativo non propone aggiornamenti inesistenti; il banner web rimanda alla pagina Releases. La compilazione Gradle locale non è verificabile nel Codespace attuale perché espone solo Java 25; la CI è fissata a Java 21 proprio per rendere la verifica riproducibile.

Il commit `436fbb1` ha introdotto `.github/workflows/build-apk.yml`; i commit
successivi `5e30396` e `65457ce` hanno corretto l'invocazione Gradle, aggiunto le
variabili pubbliche della build e il deploy Vercel esplicito. L'esecuzione
definitiva `32037676638` è verde e il bot ha pubblicato l'APK nel commit
`5ec68a0`. Il file pubblico verificato è
`https://gymbuilder-lemon.vercel.app/gymbuilder.apk`. Vedere la sez. 10 per il
prossimo passo: passare da APK debug a release firmata con keystore stabile.
## Aggiornamento stato — 2026-08-17: countdown e contratto LLM

Il countdown di avvio emette avvisi brevi su 3 e 2 e il segnale lungo `COUNTDOWN_COMPLETED` quando viene visualizzato 1; allo zero avvia l'azione senza produrre un quarto segnale. La generazione diretta DeepSeek condivide lo stesso prompt professionale fra i modelli configurabili e riceve un brief strutturato di tutte le scelte utente. Le discipline hanno regole esplicite: CrossFit deve produrre un WOD autentico e non Bodybuilding mascherato; il catalogo inviato è filtrato anche per inventario attrezzatura.
## Aggiornamento stato — 2026-08-17: trasporto DeepSeek affidabile

Le richieste LLM non partono più direttamente dal browser: `/api/deepseek` inoltra in modo stateless la richiesta a DeepSeek, senza salvare o loggare la chiave personale. Il client e la funzione hanno timeout espliciti, JSON Output e `thinking: disabled` per evitare generazioni strutturate indefinite. La UI distingue chiave non valida, credito insufficiente, rate limit, timeout e problemi di connessione invece di restare su `loading` per sempre.
## Aggiornamento stato — 2026-08-17: contratto segnali lavoro/recupero

Il contratto audio/vibrazione è uniforme: ogni countdown di fase emette WARNING brevi su 3, 2 e 1; il successivo evento di transizione (`SET_STARTED`, `WORK_STARTED`, `ROUND_STARTED` o `REST_STARTED`) emette un unico segnale lungo da un secondo. Anche completamento e time-cap sono prolungati. Il modulo notifiche non vibra più direttamente in primo piano, evitando duplicazioni con `TimerAudio`; in background la notifica usa una singola vibrazione lunga.
## Aggiornamento stato — 2026-08-17: ordine configurazione → LLM

Il wizard non permette più di invocare DeepSeek subito dopo la sola scelta della disciplina. Il pulsante LLM si trova esclusivamente in fondo allo Step 2: prima vengono definiti tutti i parametri, poi l'utente sceglie fra generazione deterministica e generazione DeepSeek. Entrambi i percorsi ricevono la stessa configurazione finale.

## Aggiornamento stato — 2026-08-17: Spinta senza dorso implicito

Il validatore impone ora la coerenza muscolare degli split Bodybuilding e Forza
anche sui workout restituiti dall'LLM. Una sessione `push` accetta come target
primari petto, deltoide anteriore/laterale e tricipiti; un esercizio primario per
il dorso viene rifiutato, salvo che `back` sia stato indicato esplicitamente fra
i muscoli carenti. La stessa regola split + eccezione carenze vale per tutti gli
altri split. Aggiunti due test dedicati; suite completa: 213 test verdi e build
produzione verde.

## Aggiornamento stato — 2026-08-17: avambracci, adduttori e addome

`Muscle` include ora `forearms` e `adductors` (etichetta UI: “Adduttori ·
interno coscia”); trapezi non sono stati aggiunti. Pull, Legs, Upper, Bro e
Front/Back riconoscono i nuovi distretti senza confonderli con dorso, bicipiti
o glutei. Il core non occupa più gli slot Bodybuilding principali previsti per
gambe/full body: `scegliRiscaldamento` inserisce sempre 1-2 attivazioni core
quando il catalogo le offre. Migrazione versionata
`20260817145218_add_forearms_adductors_core_warmup.sql` con adductor machine,
Copenhagen plank, due wrist curl e Bird dog. Suite: 215 test verdi; build verde.

**Migrazione remota completata:**
`20260817145218_add_forearms_adductors_core_warmup.sql` è stata applicata al
progetto `geqhxhgrameaugawmaej`. Un dry-run successivo ha restituito
`upToDate: true`, zero migrazioni pendenti. La CLI va autenticata passando
`SUPABASE_ACCESS_TOKEN` direttamente al processo: il portachiavi persistente
del Codespace può restituire 401 anche con un token valido.

## Aggiornamento stato — 2026-08-17: CrossFit per componenti

CrossFit Standard non viene più gonfiato fino a sei esercizi né filtrato sui
singoli muscoli carenti. La struttura è compatta: warm-up, un solo elemento
Skill/Strength, WOD da 3-4 movimenti e 1-2 Accessory/Prehab. Le carenze
orientano Skill e accessori, mentre il WOD conserva varietà di pattern. Il
livello beginner usa davvero soltanto esercizi beginner; intensità e
complessità restano scalate. Inventario e attrezzatura sono vincoli rigidi in
tutti i blocchi: test dedicato con soli manubri conserva la struttura usando
solo manubri/corpo libero. Prompt DeepSeek e validatore condividono lo stesso
contratto; il Runner include entrambi i blocchi `main`. Suite completa: 216
test verdi e build produzione verde.

## Aggiornamento stato — 2026-08-17: barra Scarica app

La versione web mostra sempre in alto una barra sticky “GymBuilder Android”
con pulsante `Scarica app`, anche prima del login. Il link punta direttamente a
`/gymbuilder.apk` e usa il filename `gymbuilder.apk`. La barra è esclusa dentro
la piattaforma nativa Capacitor per non proporre all'APK di scaricare sé stesso.
Rimossa la vecchia dipendenza del banner da dispositivo, dismiss persistente e
`version.json.apkUrl`. Suite completa verificata insieme alla correzione Spinta:
218 test verdi; build produzione verde.

## Aggiornamento stato — 2026-08-17: carenze esplicite e split Spinta

Il profilo biomeccanico non inventa più carenze in base al sesso: se l'utente
seleziona “standard”, l'elenco resta vuoto. Nelle sessioni preset, le carenze
sono richiami separati e non vengono più trasformate in `target_muscles`; i
target rigidi sono applicati soltanto quando l'utente sceglie esplicitamente i
muscoli della seduta. Lo stesso contratto è stato applicato al prompt e alla
validazione DeepSeek. Risultato: `push` standard non contiene dorso, rematori o
tirate; il dorso può entrare soltanto come singolo `richiamo carenza` quando
`back` è stato scelto esplicitamente. Test dedicati inclusi nella suite di 218
test verdi; build produzione verde.

## Aggiornamento stato — 2026-08-17: avvio Tabata sicuro su Android

Rimosso l'auto-start del Tabata all'ingresso nel Runner: la schermata di
anteprima mostra `Avvia Tabata` e il countdown parte soltanto dal tocco
esplicito dell'utente. Nell'APK la WebView non richiede più in parallelo il
permesso Web Notification: `POST_NOTIFICATIONS` viene gestito esclusivamente
dal plugin Android. Se il permesso viene negato oppure Android rifiuta il
foreground service, il plugin restituisce un fallback non fatale e il timer
React continua senza terminare l'app. Suite completa: 218 test verdi; build web
verde e `cap sync android` riuscito. La build Gradle locale resta non eseguibile
nel Codespace privo di Android SDK; la GitHub Action dispone dell'SDK e deve
validare/produrre il nuovo APK.

## Aggiornamento stato — 2026-08-17: sessione fix multipli (Tabata, CrossFit, Android nativo) + Hybrid pianificato ma non iniziato

Sessione lunga con l'utente che ha testato l'app dal vivo (web e APK) e segnalato bug uno alla
volta. In ordine cronologico, tutti corretti e verificati (test + build + lint), tutti pushati e
deployati (Vercel auto-deploy su push a `main`; GitHub Action ricompila l'APK a ogni push, vedi
`.github/workflows/build-apk.yml`):

- **Tabata bloccava l'app**: `Create.tsx` marcava la sessione "attiva" e saltava all'anteprima del
  Runner prima ancora che l'utente premesse Inizia, per il solo Tabata; combinato col redirect
  automatico su `/avvia` quando c'è una sessione attiva (`App.tsx`), l'utente restava intrappolato
  senza tasto Indietro. Ora il Tabata segue lo stesso percorso di anteprima di tutte le altre
  modalità.
- **"Ultimo allenamento" non cliccabile**: aggiunti i tasti Vedi dettagli/Ripeti.
- **Sessione singola Bodybuilding a gruppi scelti multi-split** (es. deltoide anteriore+laterale+
  posteriore) veniva rifiutata dal validatore perché lo split restava sull'ultimo preset (`push`)
  anche in modalità gruppi-a-scelta. Ora lo split resta `null` in quel caso, come già per CrossFit/
  Hybrid; `Create.tsx` ricade su `full_body` solo per generare, la validazione passa dal controllo
  sui target scelti.
- **"Cindy adattata sui muscoli target"** (nuova funzione): scegliendo Cindy senza altro resta la
  Cindy ufficiale; scegliendo anche muscoli target, il WOD usa movimenti esclusivamente su quei
  muscoli mantenendo la struttura di Cindy (3 movimenti, AMRAP 20', schema 5-10-15). Fran/Grace/
  Helen restano benchmark fissi non toccati.
- **Benchmark CrossFit fisso (Cindy/Fran/Grace/Helen) non deve avere Forza/Skill né Accessory**:
  un benchmark è già un allenamento completo da solo; quei due blocchi restano solo quando
  l'utente sceglie "WOD personalizzato sui target" (`benchmark: 'custom'`). Adattato anche il
  controllo minimo-esercizi del validatore, che altrimenti avrebbe sempre rifiutato Grace
  (ufficialmente un solo movimento, "30 Clean & Jerk").
- **Crash Android "premo avvia, fa 3-2-1 e si chiude" su qualsiasi allenamento**: la vera
  `ServiceCompat.startForeground()` avviene dentro `onStartCommand()` di `WorkoutTimerService`,
  fuori dal try/catch che un fix precedente aveva messo solo sulla chiamata Capacitor lato plugin.
  Su target SDK 35 un'eccezione lì crashava l'intero processo. Avvolto anche questo in try/catch:
  in caso di errore il servizio nativo si ferma da solo, il timer React resta comunque la fonte di
  verità del countdown.
- **Vibrazione non funzionava mai in APK**: mancava `android.permission.VIBRATE` nel manifest.
- **"Solo vibrazione" non era davvero silenzioso**: i tre bip del conto alla rovescia 3-2-1 non
  rispettavano l'impostazione "silenzioso" di inizio/fine. Corretto in `audio.ts`.
- **Crash dopo la seconda pausa**: `publishBackgroundTimer` fermava/riavviava il servizio Android
  in foreground a ogni pausa/ripresa — stessa famiglia del crash "3-2-1" sopra. In pausa il
  servizio nativo ora non viene più fermato, solo alla fine/uscita reale della sessione.
- **Notifica/banner in background**: ora mostra fase e giro corrente (es. "Lavoro · Giro 3/8" per
  Tabata/EMOM/Intervals, "AMRAP · 2 giri"), non solo l'etichetta generica; aggiunto
  `VISIBILITY_PUBLIC` alle notifiche così il countdown resta leggibile a schermo bloccato.

**In sospeso, non ancora iniziato — richiesta esplicita dell'utente:** sostituire il motore
`generators/hybrid.ts` (oggi: warmup + 2 alzate forza + metcon che alterna cardio/isolamento, vedi
sopra) con una nuova architettura "Functional Bodybuilding" a 3 blocchi sequenziali a costo
neurale decrescente — Blocco A: 2 esercizi forza (~35% tempo), Blocco B: metcon EMOM/AMRAP/For Time
a 3-4 stazioni con alternanza Anaerobico pesi/Aerobico cardio/Anaerobico corpo libero (~30%),
Blocco C: 1 superserie da 2 esercizi isolamento carenze, 2 round, 60s recupero (~20%) — con
scalabilità dinamica sul tempo (Express 30-40', Standard 45-60', Extended 70-80') e fallback
attrezzatura espliciti. L'utente ha confermato di voler **sostituire** l'Hybrid esistente (non
aggiungere una modalità nuova). Un piano dettagliato è stato scritto e approvato
(`~/.claude/plans/wondrous-tickling-boole.md` nella sessione Claude Code, non nel repo) ma
l'implementazione non è partita: due domande di chiarimento (tenere il blocco Riscaldamento? scelta
manuale o automatica del formato EMOM/AMRAP/For Time nella sessione singola?) sono state poste ma
l'utente è passato ad altro prima di rispondere. Punto di ripartenza: il Blocco C (superserie: due
esercizi consecutivi senza recupero, poi recupero solo a fine coppia, per N round) non ha nessun
equivalente nell'attuale modello `WorkoutBlock`/`PrescribedExercise`/Runner — serve un nuovo
`format` per i blocchi `kind: 'metcon'` (es. `'superset'`) e una nuova sezione di rendering/
esecuzione in `Runner.tsx`, sul modello di come oggi convivono già i rami `aGiri`/`aIntervalli`/
`amrap`. Il resto dell'architettura Hybrid attuale (tipi, weekly programming PPL+HY, UI generica a
blocchi) può restare com'è: sostituire in loco richiede di toccare solo `generators/hybrid.ts` e
`generators/__tests__/hybrid.test.ts`.

Verifica di questa sessione: 227 test verdi, build production verde, lint senza errori (resta il
warning storico in `Runner.tsx`). I fix lato nativo Android (foreground service, vibrazione,
notifiche) non sono verificabili in locale: manca un dispositivo/emulatore Android in questo
ambiente, verificati solo per compilazione tramite la GitHub Action che ricompila l'APK a ogni push.

## Aggiornamento stato — 2026-08-18: crash timer nativo in background (secondo fix)

L'utente ha segnalato che l'app si chiude ancora durante l'allenamento (schermo spento, dopo un
cambio fase come lavoro→riposo), nonostante il fix del 17/08 (`a125bd8`, try/catch su
`onStartCommand`). Causa: quel fix intercetta solo le `RuntimeException` sincrone dentro
`onStartCommand()`. Il ramo che gestiva un `deadline` già scaduto chiamava `stopTimer()` senza mai
chiamare `startForeground()` — ma `WorkoutTimerPlugin` avvia questo servizio con
`startForegroundService()`, che impone `startForeground()` entro pochi secondi *da ogni esito*,
non solo da quello valido. Se non arriva, Android lancia
`ForegroundServiceDidNotStartInTimeException` **dopo** che `onStartCommand()` è già tornato: un
crash lanciato dal sistema, non dal codice del Service, che nessun try/catch Java o JS può
intercettare. Un deadline già scaduto arriva quando il tick React che lo calcola
(`Runner.tsx` → `publishBackgroundTimer`) viene eseguito in ritardo perché throttled da Chromium
con l'app in background/schermo spento — il valore è corretto quando viene calcolato, ma può
arrivare al lato nativo dopo essere già scaduto.

Fix: `onStartCommand()` ora chiama sempre `startForeground()` — con una notifica "a zero secondi"
quando il deadline è già scaduto, tramite il nuovo metodo `promoteToForegroundThenStop()` — prima
di fermare il servizio, in ogni ramo raggiungibile da un avvio via `startForegroundService()`.
Non cambia nulla nel percorso normale (deadline valido): notifica persistente con countdown e
tap-per-tornare all'allenamento (`openWorkoutIntent()` → `MainActivity` → resume automatico su
`/avvia` via `activeSession`) restano gli stessi. **Non riproducibile né verificabile in questo
Codespace** (niente Android SDK, sez. 9/TODO): individuato per lettura del contratto Android per
`startForegroundService`, non da un log di crash reale — resta da confermare su un telefono vero,
vedi TODO.

## Aggiornamento stato — 2026-08-18: riorganizzazione wizard Genera a 9 step

Il wizard di `Genera` (`src/pages/Create.tsx`) passa da 2 a 9 step con gating in avanti (non si
può passare allo step successivo se quello corrente non è valido; il ritorno indietro resta
sempre libero): **1** Livello, **2** Cosa vuoi creare (Programma/Sessione + numero giorni), **3**
Seduta di oggi (disciplina/e), **4** Split — o Timer Tabata, o Benchmark/Metodica CrossFit più
Muscoli Target di Oggi per CrossFit/Hybrid, a seconda della disciplina scelta — **5** Attrezzi,
**6** Muscoli carenti, **7** Preferenze (corpo libero/elastici + avanzate per preferiti/esclusi),
**8** Durata, **9** Genera. Il Tabata salta direttamente dallo step 4 al 9 (non usa
attrezzatura/carenze/preferenze/durata, come già in precedenza). Le note per l'LLM si aprono
inline nello step 9 al tap su "Genera con DeepSeek", invece di un campo sempre visibile.

Rimossa solo la modalità libera "Gruppi a Scelta" della sessione singola Bodybuilding/Forza
(sceglievi i muscoli da zero, senza split): su richiesta esplicita dell'utente, che ha chiarito
come i muscoli carenti già ripartiscano gli slot dentro lo split scelto (es. PPL Push + carenze
spalle/braccia → invece di 3 petto: 1 petto, 2 spalle, 1 misto, 1 bicipiti, 1 tricipiti, con
richiamo settimanale sugli altri giorni compatibili) — un secondo modo di scegliere i muscoli era
ridondante. La sessione singola BB/Forza ora usa sempre split preimpostato + carenze. **Non
toccato** invece il campo "Muscoli Target di Oggi (opzionale)" per CrossFit/Hybrid aggiunto nella
sessione precedente (18/08, Codex): CrossFit/Hybrid non hanno un concetto di split (`split` resta
sempre `null` per quei modi in `generateWeeklyProgram`), quindi quel target picker non è
ridondante con le carenze nello stesso modo — resta l'unico modo di orientare un WOD full-body.

Nessuna modifica al motore di generazione: la riorganizzazione è solo di `Create.tsx` (UI/gating),
riapplicata sopra le modifiche della sessione precedente (spostati nello step 4 il campo
"Metodica / Benchmark CrossFit" e il nuovo "Muscoli Target di Oggi" con lo stesso contenuto/copy
già scritto da Codex, non riscritti da zero). 227 test verdi, `tsc`/`eslint` puliti, build
produzione verde. Verificata a mano nel browser (Playwright headless, catalogo finto perché le
credenziali Supabase reali risultano oscurate in questo ambiente): tutti e 9 gli step si aprono
nell'ordine giusto con i titoli corretti, il gating dello step 3 blocca "Continua" senza
discipline selezionate, la navigazione indietro dallo step 9 allo step 1 funziona, e il salto
Tabata step 4→9 funziona. Non verificato invece il percorso di generazione vera (serve un
catalogo reale) né il comportamento su dispositivo Android reale.

## Aggiornamento stato — 2026-08-18: il fix del crash non bastava, permesso e resume Tabata

L'utente ha installato la build 1.0.20 (commit `0d7dca3`, il fix `promoteToForegroundThenStop`
sopra) e ha comunque riscontrato lo stesso pattern: al primo Tabata il permesso notifiche gli è
stato chiesto 2-3 volte invece di una, e l'app si è chiusa comunque al primo passaggio
lavoro→riposo; riaprendo torna sempre alla schermata "Avvia Tabata" invece di riprendere il round.
Trovate e corrette due cause reali distinte, entrambe più probabili del bug già risolto:

- **Permesso richiesto implicitamente in corsa con i round**: `requestTimerNotifications()`
  lato JS non chiedeva mai davvero il permesso nativo (`if (isNativeWorkoutTimerAvailable())
  return true`, un no-op ottimistico): la vera richiesta avveniva solo al primo
  `WorkoutTimer.start()`, dentro il primo cambio di fase. Con un Tabata che cambia fase ogni
  10-20s, se l'utente non rispondeva al dialogo di sistema abbastanza in fretta, i round
  successivi arrivavano mentre la Promise del primo `start()` era ancora pendente:
  `activeNativeTimer` (il guard anti-duplicati in `workoutTimer.ts`) restava `null` finché quella
  Promise non si risolveva, quindi ogni round nel frattempo tentava un nuovo `start()`. Quando la
  richiesta finiva per risolversi, poteva farlo con un `deadline` ormai di round precedenti,
  quindi già scaduto — la stessa famiglia di crash del fix precedente, solo con una causa diversa
  a monte. Aggiunto un nuovo metodo nativo `ensurePermission` (stessa guardia
  `permissionRequestInFlight`/`permissionDenied` di `start()`, ma senza avviare alcun timer) e
  `requestTimerNotifications()` ora lo chiama e lo attende *prima* del countdown iniziale: il
  dialogo di sistema compare una sola volta, upfront, prima che qualunque round cominci.
- **Il resume dopo crash non funzionava mai per un Tabata puro**: lo stato di avanzamento salvato
  in `RUNNER_PROGRESS_KEY` viene ripristinato solo se `progress.iniziato === true`, ma quel flag
  si imposta solo nella schermata di Riscaldamento (`setIniziato(true)` al tap su "Comincia") o
  nella sezione principale a serie. Un Tabata puro (niente riscaldamento, niente esercizi
  principali, tutto nel blocco Metcon) passa dritto alla schermata "Avvia Tabata" — il cui
  handler non impostava mai `iniziato`. Risultato: il guard di ripristino restava sempre falso, e
  ogni riapertura (dopo un crash o anche solo dopo aver chiuso l'app) mostrava di nuovo la
  schermata iniziale invece di riprendere il round in corso, anche quando lo stato dettagliato
  (round, fase, deadline) era salvato correttamente. Aggiunto `setIniziato(true)` anche in quel
  handler.

227 test verdi, `tsc`/`eslint` puliti (entrambi i fix sono minimi e mirati, nessuna modifica al
motore). **Nessuno dei due è verificabile in questo Codespace** (niente Android SDK/dispositivo):
individuati per lettura del codice a partire dalla sequenza esatta di sintomi riportata
dall'utente (permesso chiesto più volte + crash al primo cambio fase + resume rotto), non da un
log di crash reale. Resta da confermare su un telefono vero che il permesso compaia una sola
volta e che il Tabata non si chiuda più — vedi TODO.

Sistemato anche il secret GitHub Actions `VERCEL_TOKEN` (era scaduto/non valido: lo step "Deploy
APK to Vercel" falliva da almeno il 17/08, senza impatto reale sugli utenti perché il deploy vero
passa dall'integrazione automatica GitHub→Vercel, ma lasciava una ✗ rossa ad ogni build).

## Aggiornamento stato — 2026-08-18: il Tabata continua a chiudersi, aggiunta diagnostica crash reale

L'utente ha installato 1.0.21 (i due fix sopra) e il crash si ripresenta **a ogni singolo giro**
(non solo al primo), con il "richiede avvio più volte" ancora presente prima del primo giro.
Nota positiva: il fix del resume funziona — riaprendo l'app dopo ogni crash riprende dal giro
giusto (2°, poi 3°) invece di tornare sempre alla schermata iniziale, come confermato
dall'utente. Terza ipotesi via lettura del codice senza log reale rischiava di essere un altro
tentativo alla cieca: **invece di correggere ancora per ipotesi, aggiunta cattura del crash
reale**.

Nuovo `CrashLogger.java`: installa un `Thread.setDefaultUncaughtExceptionHandler` che scrive
ogni eccezione fatale non gestita (incluse quelle lanciate dal sistema come
`ForegroundServiceDidNotStartInTimeException`, che arrivano comunque come eccezione Java normale
sul thread principale, catturabile da questo handler) su file, poi richiama l'handler precedente
così il comportamento di chiusura resta quello standard. Nuovo `DiagnosticsPlugin.java` +
`src/native/diagnostics.ts` espongono quel log alla WebView. Nuova sezione "Diagnostica crash" in
Profilo (`ProfilePage.tsx`, visibile solo su Android nativo): mostra il testo del crash più
recente con pulsanti Copia/Cancella, così l'utente può incollarlo qui in chat senza bisogno di
adb o di un file manager.

**Prossimo passo reale**: chiedere all'utente di riprodurre ancora il crash Tabata, poi aprire
Profilo → Diagnostica crash e incollare il contenuto. Da lì si potrà correggere la causa vera
invece di continuare per ipotesi. 227 test verdi, `tsc`/`eslint` puliti, build verde. Il logger
stesso non è testabile in questo Codespace (niente Android SDK/dispositivo).

## Aggiornamento stato — 2026-08-19: regola di aggiornamento memoria esplicita + restyling banner notifica timer

**Nuovo `CLAUDE.md`** in root: rende vincolante, per qualsiasi sessione Claude Code aperta su
questo repo (non solo via `/handoff`), la regola di "salvataggio automatico" già presente nel
protocollo AI-OS centrale — aggiornare `AIOS_STATE.md` (e `TODO.md` se pertinente) prima di
dichiarare concluso un lavoro, poi commit insieme al codice. Prima esisteva solo nel repo
esterno `ai-os` e nella sezione `SALVATAGGIO AUTOMATICO` di `AIOS_PROTOCOL.md`: valeva solo se
qualcuno la faceva leggere all'AI. Ora è caricata automaticamente all'apertura di questa cartella
in Claude Code.

**Restyling banner notifica timer Android** (`WorkoutTimerService.java` +
`res/layout/notification_timer.xml` + nuovi drawable `notification_card_bg`,
`notification_icon_bg_{work,rest,other}`, `notification_badge_bg`), su richiesta esplicita
dell'utente con mockup HTML di riferimento (card scura arrotondata, badge icona colorato per
fase, countdown grande centrato, pillola col testo fase/giro sotto invece della vecchia riga di
testo separata in alto a sinistra). Colore lavoro cambiato da giallo puro (`#FFD600`) ad ambra
(`#F59E0B`) per aderire al riferimento; riposo resta blu (`#40C4FF`).

Rimossa la TextView `notification_timer_label` (fase in maiuscolo, es. "LAVORO") perché
ridondante col testo già passato da JS nella pillola (es. "Lavoro · Giro 1/15", da
`Runner.tsx`); di conseguenza rimosso anche `phaseTitle()` in Java, non più usato.
`buildCountdownViews()` ha cambiato firma (un solo testo — `badgeText` — invece di
`exerciseLabel`+`topLabel`); lo stato "completato" ora mostra "Completato" nella pillola invece
del vecchio "COMPLETATO" in alto.

**Non verificabile in questo Codespace** (niente Android SDK/dispositivo, vedi sopra): solo XML
validati con `xmllint` (ben formati) e coerenza letta a mano nel Java (nessun riferimento
residuo a `notification_timer_label`/`phaseTitle`). **Prossimo passo**: verificare sul telefono
reale, dopo la prossima build APK via GitHub Actions, che il banner appaia come nel riferimento
sia a schermo acceso (banner in alto) sia su lock screen, e che i colori/badge cambino
correttamente fra lavoro e riposo.

**Chiarimento aggiunto in `CLAUDE.md` nella stessa sessione**: l'utente ha chiesto esplicitamente
che l'app si aggiorni da sola a ogni modifica, come regola obbligatoria. Verificato che il
meccanismo **esiste già** e non richiede nulla di nuovo: `build-apk.yml` si attiva a ogni push su
`main` (non al solo commit locale), bumpa `versionCode`/`versionName`, builda un APK debug,
aggiorna `public/gymbuilder.apk` + `public/version.json` e pubblica su Vercel da solo — senza
bisogno di tag `android-v*` (quello serve solo per la release firmata "ufficiale", un passo
separato). Il tag `android-v*` menzionato nella risposta precedente della chat non era quindi
necessario per l'aggiornamento automatico standard. Il pezzo mancante era solo **il push**: il
commit precedente di questa sessione (banner timer) era rimasto solo locale. Aggiunta la regola
in `CLAUDE.md` per fare sempre `git push origin main` dopo ogni commit, senza chiederlo, salvo
richiesta esplicita contraria dell'utente.

## Aggiornamento stato — 2026-08-19: correzione manuale esercizio/serie + tempo totale allenamento in `Runner.tsx`

Richiesta utente: durante l'allenamento deve poter vedere a che esercizio/serie è arrivato e
quanti ne restano; se il timer perde il filo (es. dimenticato di avviarlo mentre si era già
passati all'esercizio successivo) deve poter scegliere lui l'esercizio/serie corretti; deve
esserci un tempo totale stimato dell'allenamento, separato dal timer di recupero, che scorre
dall'avvio vero (dopo il conto alla rovescia) e resta visibile sia sull'esercizio corrente sia
quando si guardano gli esercizi rimanenti.

**Aggiunto in `src/pages/Runner.tsx`**:
- `WorkoutClock`: componente che mostra `mm:ss / ~N min` (la stima è `GeneratedWorkout.duration_min`,
  mai un tetto che chiude l'allenamento da solo), tick ogni secondo leggendo `inizio.current`
  (il ref esistente, non nuovo stato). Mostrato in "Serie in corso", "Recupero" e nella nuova
  schermata "Sono qui".
- Schermata "Sono qui" (`mostraElenco`, guardia messa prima dei rami `sezione === 'metcon'` e
  `fase.tipo === 'recupero'`): elenco di tutti gli esercizi del blocco principale, esercizi
  precedenti barrati "✓ fatto", esercizio corrente con bordo ambra, un chip "Serie N" per ogni
  serie di ogni esercizio. Toccare un chip chiama `selezionaEsercizio(iEs, serie)`, che imposta
  `fase = { tipo:'serie', iEs, serie }`, toglie la pausa e chiude la schermata — riporta
  l'utente esattamente dove dice di essere, senza toccare timer di recupero/metcon (che restano
  quello che erano, dato che si esce sempre dallo stato 'recupero' quando si sceglie una serie).
  **Scope**: solo blocco principale (esercizi/serie), non il Metcon — la richiesta dell'utente
  descriveva esplicitamente esercizi in sequenza con serie, non round Metcon.
- Link di ingresso: "Non sei qui?" nella barra sotto il progresso in "Serie in corso", "Non è
  la serie giusta? Correggi" in fondo a "Recupero".

**Verificato in un browser reale** (non solo `tsc`/`eslint`/test, per una volta possibile: la
Runner non richiede login se c'è già un workout in `localStorage['gymbuilder:allenamento']`).
Avviato `npm run dev` con le `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` pubbliche già note (le
stesse del workflow CI), pilotato con Playwright headless (Chromium della cache
`~/.cache/ms-playwright`, non nei `devDependencies` del progetto: usato solo per questa verifica
manuale, non aggiunto al repo). Confermato via screenshot e testo pagina: l'orologio scorre
(0:00 → 0:02 → 0:03), la schermata "Sono qui" mostra "Esercizio 1 di 2 · ne restano 1" con i
chip corretti, selezionare "Serie 1" del secondo esercizio porta davvero lì (titolo cambiato in
"Alzate laterali"), e dopo aver completato quella serie il Recupero mostra correttamente "serie
2 di 2". Nessun errore console. 229 test verdi, `tsc`/`eslint` puliti (1 warning preesistente
non legato a queste modifiche), `npm run build` verde.

**Non verificato**: comportamento su un allenamento reale con riscaldamento (il workout di test
non ne aveva, quindi è entrato dritto in "Serie in corso" invece di passare dalla schermata
"Comincia" — comportamento preesistente, non toccato da questa modifica) e la coerenza con la
notifica Android in background quando si usa "Sono qui" mentre l'app è in background (dovrebbe
funzionare, dato che `selezionaEsercizio` fa uscire `fase` da `recupero`, quindi l'effetto che
pubblica lo stato in background smette di mostrare un countdown, come già succede oggi entrando
in "Serie in corso" — ma non testato su device reale).

## Aggiornamento stato — 2026-08-19: Lagging Muscle Engine (focus_portion, swap navigabile, rotazione settimanale, sequenziamento fatica/sinergie, parità DeepSeek)

Richiesta utente (due feature: "Lagging Muscle Engine" e "Smart Exercise Swap", con spec
dettagliata stile PPL/BroSplit generico). **Prima di implementare, verificato che gran parte del
richiesto esisteva già in produzione**, in forma più sofisticata della spec: `weakPoints.ts`
calcola volume settimanale reale dai workout completati e decide i richiami (non uno schema
fisso); `bodybuilding.ts` (`applicaPrioritaAssegnate`) già riserva slot carenza e taglia gli
slot non prioritari per restare a 6 esercizi (compensazione volume); `replacement.ts`
(`findExerciseReplacements`, plurale) già fa scoring per muscolo/pattern/attrezzo/fatica con
apprendimento adattivo, ma non era esposta in UI — `WorkoutPreview.tsx` chiamava solo la
versione singolare e applicava automaticamente il primo risultato. Piano concordato con
l'utente (via plan mode, poi esteso in conversazione): estendere questi moduli, non ricostruirli.
Piano completo in `/home/codespace/.claude/plans/synchronous-cooking-engelbart.md` (locale alla
sessione, non nel repo).

**Gap reale colmato — 6 step, tutti implementati:**

1. **`focus_portion`** (`src/types/index.ts`): nuovo tipo `'long_head'|'short_head'|'brachialis'|
   'lateral_head'|'medial_head'`, campo opzionale su `Exercise` (non NOT NULL: ha senso solo per
   bicipiti/tricipiti, non per l'intero catalogo). Migrazione
   `supabase/migrations/20260819120000_exercise_focus_portion.sql` tagga ~15 esercizi reali
   (curl/estensioni/dip) seguendo la logica biomeccanica descritta dall'utente. Fixture di test
   aggiornata con gli stessi tag + 5 righe mancanti da una migrazione precedente mai
   risincronizzata (`bayesian_curl`, `preacher_curl_macchina`, `curl_inclinata_man`,
   `pushdown_unilaterale`, `estensione_tricipiti_cavo_alto`) — la fixture resta comunque stale
   rispetto a Supabase per altri ~50 esercizi non toccati da questo lavoro, problema preesistente
   segnalato ma non risolto qui.
2. **Swap navigabile** (`replacement.ts` + `WorkoutPreview.tsx`): `findExerciseReplacements`
   ora filtra/pesa per `focus_portion` con fallback a 4 passaggi (mai fallisce per mancanza di
   tag). La modale "Sostituisci" è diventata due passi — motivo poi lista di alternative
   raggruppate per attrezzo (Manubri&Panca/Corpo Libero&Sbarra/Cavi&Elastici/Macchine&Guidati) —
   invece di applicare automaticamente la prima trovata. `sets`/`reps`/`rest_sec` erano già
   preservati dallo swap esistente, nessuna modifica necessaria lì.
3. **Rotazione settimanale per porzione** (`weeklyPlan.ts`): nuovo campo `WeeklySession.
   priority_portions`, additivo — non tocca `priority_muscles`, quindi gli 8+ test con array
   esatti in `weeklyProgram.test.ts` restano intatti. Bicipiti/tricipiti ruotano long_head→
   short_head→brachialis (o lateral/medial per tricipiti) fra le sedute della settimana che li
   richiamano. Sessione singola: nessuna settimana su cui ruotare, default fisso `long_head` in
   `bodybuilding.ts`/`strength.ts`.
4. **Badge visivo**: `note` (`'carenza'`/`'richiamo carenza'`/`'richiamo'`) non era mai mostrato
   nel blocco principale — nuovo helper `isLaggingNote` in `types/index.ts` (riconosce le note
   leggermente diverse fra bodybuilding.ts e strength.ts), badge ambra aggiunto in
   `WorkoutPreview.tsx` e in `Runner.tsx` (schermata "Serie in corso").
5. **Sequenziamento fatica/sinergie** (`shared.ts`, nuova `riordinaPerSinergie`, chiamata da
   `bodybuilding.ts` e `strength.ts` dopo la selezione esercizi): usa `secondary_muscles` e
   `local_fatigue` (già esistenti, mai letti da `ordinaSlot`). Due passaggi — priming (anticipa
   un isolamento carente subito prima del primo esercizio, anche precedente nell'ordine di
   partenza, che lo coinvolge come secondario) e anti-concatenazione (evita due slot consecutivi
   che condividono un muscolo ad alta fatica, ma **solo** quando il secondo lo coinvolge come
   secondario — mai quando condividono semplicemente lo stesso muscolo primario, che è accumulo
   di volume intenzionale, es. Bro Split). **Mai sui compound** (tier 0): il loro ordine è già
   deciso da `faticaSort`/identità dello split.
   **Trovata e corretta una regressione durante l'implementazione**: la prima versione
   dell'anti-concatenazione scattava anche su isolamenti con lo stesso muscolo primario,
   rompendo "sessione Bro Petto usa 2 compound e 3 isolamenti tutti per il petto" (3 isolamenti
   petto consecutivi sono voluti, non un bug) — corretto restringendo il trigger al solo caso
   secondario-su-primario. Verificato con test sintetici dedicati in un nuovo describe block di
   `shared.test.ts` (7 test) oltre alla suite generatori esistente.
   **Fix minimo incluso**: `adattaAlTempo` in `bodybuilding.ts` confrontava `note === 'richiamo'`
   (stringa di strength.ts) invece di riconoscere anche `'carenza'`/`'richiamo carenza'`
   (bodybuilding.ts): i richiami carenza di bodybuilding non venivano mai deprioritizzati nel
   taglio per budget di tempo. Ora usa `isLaggingNote`.
6. **Parità con DeepSeek** (`lib/deepseek.ts`): `CatalogExerciseSnapshot`/`toCatalogSnapshot`
   arricchiti con `local_fatigue`, `technical_complexity`, `focus_portion`.
   `PROFESSIONAL_WORKOUT_SYSTEM_PROMPT` ha nuove regole esplicite (stesso principio dello step 5
   in prosa): non concatenare esercizi ad alta fatica sullo stesso muscolo anche secondario,
   priming sulle carenze, non più di due esercizi pesanti di fila, sostituzione che preserva
   `focus_portion`/`local_fatigue`.

**Verificato**: 240 test verdi (229 esistenti + 11 nuovi/estesi), `tsc`/`eslint` puliti,
`npm run build` verde. Badge "Carenza" verificato in un browser reale via Playwright headless
(stessa tecnica già usata in questa sessione per il Runner) — screenshot conferma lo stile
corretto, nessun errore console. **Non verificabile in browser**: il nuovo swap navigabile in
`WorkoutPreview.tsx` — a differenza di `/avvia`, quella rotta non ha un bypass per l'autenticazione
e richiede un utente Supabase reale, non disponibile in questo Codespace. Verificato solo con
`tsc`/`eslint` e lettura attenta della macchina a stati (motivo → lista raggruppata → applica).

**Prossimo passo**: verificare manualmente in produzione (utente autenticato) che "Sostituisci"
mostri davvero i 4 gruppi per attrezzo e che scegliere un'alternativa aggiorni la scheda; generare
un programma settimanale con carenza bicipiti/tricipiti e controllare che sedute diverse
propongano davvero porzioni diverse; generare via DeepSeek con una carenza selezionata e valutare
a occhio se l'ordine rispetta le nuove regole (non verificabile in automatico, dipende da una
risposta reale del modello esterno).

**Migrazione applicata**: `20260819120000_exercise_focus_portion.sql` eseguita in produzione via
MCP Supabase (progetto `geqhxhgrameaugawmaej`) su richiesta esplicita dell'utente. Verificato via
query diretta: 15 righe taggate correttamente (6 bicipiti, 9 tricipiti). `focus_portion` è quindi
già attivo in produzione, non solo nel codice.

## Aggiornamento stato — 2026-08-19: protocolli Bodybuilding avanzati FST-7 e Top Set & Back-Off (stile CBum)

Richiesta utente: tre protocolli avanzati Bodybuilding (3-6-9 Density Tri-Set, FST-7, Top Set &
Back-Off/CBum). Dopo esplorazione e due chiarimenti con l'utente: **il 3-6-9 è rimandato** (serve
un vero motore a circuito che oggi non esiste — il Runner esegue solo sequenze flat, mai stazioni
interlacciate per round — e un carve-out più ampio nel validatore); **il logging automatico CBum
("+2.5kg se chiudi 8 rep pulite") è rimandato su richiesta esplicita** — verificato che l'app non
registra MAI reps/peso reali da nessuna parte (Runner.tsx: "Serie completata" non cattura nulla;
nessun campo simile in nessun tipo o tabella Supabase). Implementati invece **FST-7 e Top Set &
Back-Off**, che si incastrano nel motore Runner esistente senza un nuovo sistema di esecuzione.

**Dati**: `WeeklyProgramConfig.protocol?: 'standard'|'fst7'|'cbum_top_backoff'` +
`fst7_preloading?: boolean` (`types/index.ts`), additivo — nessuna migrazione, persistito
wholesale come jsonb in `training_programs.config` (`api.ts`).

**Generatore** (`bodybuilding.ts`): `GenerationConfig` guadagna `protocol`/`fst7_preloading`.
FST-7: tronca gli slot a 3 esercizi base (8-12 rep, 90-120s recupero — prescrizione dedicata,
non quella legata all'obiettivo), poi aggiunge un finisher a parte (`sets:7, reps:'10-12',
rest_sec:30, note:'fst7_finisher'`, filtrato per cavi/macchine/isolamento tramite
`isFst7FinisherEligible` in `replacement.ts`, riusata anche dallo swap). CBum: 4-5 esercizi
selezionati con la logica a slot esistente, poi ciascuno **espanso in due voci consecutive**
sullo stesso `exercise_id` — Top Set (`1x6-8 rest:180`) e Back-Off (`1x10-12 rest:150`), entrambe
scalate da `intensity` come il resto del motore. Il carico del Back-Off (-15/20%) resta
un'indicazione testuale in UI, non un numero calcolato — nessun peso registrato da nessuna parte.

**Bug reali trovati e corretti durante l'implementazione** (non nella spec, scoperti generando
davvero l'output):
- `target` per FST-7 non teneva conto del troncamento a 3 slot (restava legato a
  `baseSlot.length`, sempre ≥5): il ciclo di completamento aggiungeva comunque esercizi fino a 5.
  Corretto forzando `target = 3` quando `protocol === 'fst7'`.
- `rimuoviDuplicati` (shared.ts) e `validator.ts:46` rifiutano/cancellano ID esercizio ripetuti:
  un Top Set + Back-Off dello stesso esercizio veniva trattato come duplicato accidentale — il
  validatore bloccava OGNI sessione CBum generata (`Create.tsx` la respinge con un errore secco
  se `validateWorkout` fallisce). Corretto in entrambi i punti riconoscendo `note === 'top_set'/
  'back_off'` come coppia legittima, non un duplicato.
- `portaCompoundInApertura` avrebbe scavalcato il finisher FST-7 in preloading (lo sposta sempre
  in testa un compound se non è già lì): aggiunta stessa eccezione già usata per le carenze.
- Il warning "solo N esercizi, attrezzatura insufficiente" usava una soglia fissa di 6, sempre
  sbagliata per FST-7 (4 attesi) e CBum (8-10 attesi dopo l'espansione).

**UI**: selettore "Protocollo di Allenamento" in Create.tsx Step 4 (stesso pattern chip di
"Sistema Split Bodybuilding"), toggle Pre-Loading solo per FST-7. Badge Top Set/Back-Off/FST-7 in
`WorkoutPreview.tsx` e `Runner.tsx` (stesso meccanismo del badge Carenza). Messaggio alternato
FST-7 nella schermata Recupero di Runner.tsx: serie dispari appena completata → "Posa ·
Contrazione isometrica (10s)" + promemoria acqua; serie pari → "Allungamento fasciale passivo
(10s)" — deciso da `fase.serie % 2` sull'esercizio con `note === 'fst7_finisher'`.

**Verificato**: 246 test verdi (240 + 6 nuovi/estesi: generatore FST-7/CBum su tutti gli split,
filtro swap finisher, carve-out validatore), `tsc`/`eslint`/`npm run build` puliti. Verificato in
un browser reale (Playwright via `/avvia`, bypassa l'auth): badge Top Set/Back-Off/FST-7 con
contatore serie live, messaggio alternato che cambia correttamente fra serie dispari e pari,
nessun errore console.

**Non fatto, esplicitamente rimandato su richiesta dell'utente**: protocollo 3-6-9 Density
Tri-Set (serve un motore a circuito nuovo); logging automatico CBum (serve una tabella di log
reps/peso e un input in Runner, oggi assenti ovunque nell'app) — il badge/target CBum resta
puramente informativo, senza rilevare cosa l'utente fa davvero.

## Aggiornamento stato — 2026-08-19: fix reale — le carenze affollavano Push/Pull svuotando petto/dorso

Bug segnalato dall'utente: pianificando un PPL con carenze deltoidi+bicipiti+tricipiti, il
sistema affollava Push (o Pull) di esercizi spalle/braccia fino a ridurre il petto (o il dorso,
il muscolo identitario dello split) a **un solo esercizio invece dei 2 standard**. Riprodotto e
confermato con uno script diretto prima di toccare codice. **Non era un'impressione: era un
comportamento già deliberatamente testato come "corretto"** da una sessione precedente (test
"usa un solo esercizio per ogni distretto") — l'utente ha corretto quella scelta di design.

**Causa reale, due parti**:
1. `weeklyPlan.ts` (`splitAccogliePriorita`, sistema 'ppl'): bicipiti e tricipiti erano
   "compatibili" sia con Push sia con Pull contemporaneamente (non solo con la loro sessione
   biomeccanica naturale — tricipiti spinge, bicipiti tira), quindi ogni carenza braccia
   reclamava uno slot dedicato in ENTRAMBE le sessioni. Corretto: tricipiti nativo solo di Push,
   bicipiti nativo solo di Pull (la seconda esposizione settimanale resta comunque garantita dal
   richiamo incrociato esistente, non dalla doppia compatibilità).
2. `bodybuilding.ts` (`applicaPrioritaAssegnate`, riscritta): con molte carenze dichiarate,
   tagliava slot al muscolo identitario dello split per farle stare, fino a ridurlo a 1 copia.
   Nuova logica su richiesta esplicita dell'utente ("si deve sempre partire dallo standard per
   poi modificarlo"):
   - **Mai duplicare** un muscolo già coperto dalla struttura standard: si tagga lo slot
     esistente, non se ne aggiunge un secondo.
   - **Sostituisce, non allunga**: una carenza assente dallo split rimpiazza uno slot esistente
     invece di far crescere la sessione oltre 6 (prima: append poi taglio a valle).
   - **Sacrifica prima la ridondanza**: fra gli slot sostituibili si preferisce chi ha più copie
     (es. una delle 2 panche petto) — mai l'identitario finché esiste un'alternativa reale.
   - **Massimo 3 carenze dedicate per sessione, sempre** (prima: fino a 6 se l'utente ne
     dichiarava molte). Le carenze in eccesso restano fuori da oggi: la settimana le richiama
     in un altro giorno compatibile, invece di sovraccaricare questa sessione.
   - Conserva il ruolo (composto/isolamento) dello slot sostituito, MA solo se il muscolo
     carente lo supporta davvero (bicipiti/tricipiti/deltoidi non hanno varianti composte nel
     catalogo — altrimenti lo slot restava vuoto, nessun candidato trovato).

**Due bug secondari trovati e corretti mentre si verificava il fix con l'output reale** (non
nella richiesta iniziale):
- La sostituzione poteva creare uno slot "bicipiti composto" (inesistente nel catalogo): lo slot
  restava vuoto e un fallback casuale lo riempiva con un duplicato a sorpresa. Corretto
  vincolando `compound` a `COMPOUND_CAPABLE_MUSCLES` anche nel percorso di sostituzione.
- Nel caso mono-muscolo (Bro Petto, dove l'identitario è l'unico muscolo esistente e quindi
  l'unica alternativa possibile), l'ordine naturale degli slot faceva sacrificare i 2 compound
  per primi, lasciando la sessione priva di un compound in apertura — violando l'invariante
  "apre sempre con un compound" verificato altrove nel motore. Corretto con una preferenza
  esplicita a sacrificare un isolamento prima di un compound, **ma solo in quel caso limite**:
  nel caso normale (più muscoli distinti disponibili) non c'è motivo di preferire isolamento a
  compound, e applicarlo ovunque faceva sparire tricipiti da un altro test legittimo.

**Verificato**: 247 test verdi (246 + 1 nuovo test end-to-end che genera l'intero programma
settimanale PPL con 5 carenze e verifica che petto/dorso restino sempre ≥2 in ogni seduta),
`tsc`/`eslint`/`npm run build` puliti. Riprodotto lo scenario esatto dell'utente con uno script
diretto (generateWeeklyProgram + generaBodybuilding insieme): Push ora mantiene la sua struttura
piena (2 compound + 1 isolamento petto) più 3 carenze ben distribuite, Pull idem con dorso —
invece di 1 solo esercizio petto sommerso da spalle/braccia. Tre test esistenti aggiornati con
commenti che spiegano il cambio di comportamento (erano scritti per il vecchio design, ora
esplicitamente corretto).

**Non verificato su un allenamento reale generato dall'app** (solo unit test + script diretto):
prossimo passo suggerito in TODO.md.

## Aggiornamento stato — 2026-08-19: FST-7 sempre rigettato, dip esclusi dal motore, ristrutturazione Push/Legs, tetto spalle nelle carenze PPL, avvicinamento CBum

Feedback utente (messaggio unico, denso, tradotto e verificato punto per punto prima di
toccare codice): "FST-7 non vedo nulla" (poi chiarito: seduta generata vuota/con errore); nel
CBum manca "l'avvicinamento" prima del Top Set; nel PPL le carenze deltoidi non devono togliere
i bicipiti quando ci sono già 2 esercizi spalle; in Push, dopo 2 panche uno shoulder press
pesante come 3° esercizio è "non serve, non è utile, controproducente" — il 3° deve essere
alzate laterali, con un dip come esercizio intermedio "a più muscoli" (tricipiti+petto+deltoide
anteriore); Legs: 2 composti quad/femorali, 1 isolamento quad, 1 isolamento femorali, 1
polpacci, 1 glutei. Il protocollo 3-6-9 resta esplicitamente rimandato su richiesta dell'utente
(nessuna modifica). Pull lasciato invariato: l'utente non ha dato un esempio concreto di
"esercizio a più muscoli" per Pull come il dip per Push (a differenza di Push, qui il
complaint riguardava solo il tetto carenze, non la struttura di default) — se ne vuole uno,
serve un esempio concreto prima di inventare una struttura non richiesta.

**Bug reale #1 — causa vera di "FST-7 non vedo nulla" (seduta vuota/con errore)**:
`WorkoutGenerationConfig` (types/index.ts) non ha mai avuto un campo `protocol`, quindi
`Create.tsx` (`buildGenerationConfig`) non lo passava mai al validatore. `validator.ts`
impone un minimo fisso di 6 esercizi per ogni sessione bodybuilding, ma FST-7 ne produce
apposta solo 4 (3 base + finisher): la sessione veniva **sempre** rigettata come non valida.
Corretto aggiungendo `protocol?: BodybuildingProtocol` a `WorkoutGenerationConfig`, passandolo
da `Create.tsx` (solo per `session.mode === 'bodybuilding'`), e rendendo il minimo del
validatore consapevole del protocollo (`4` per `fst7`, altrimenti `6`). Riprodotto e coperto da
un nuovo test in `validator.test.ts` che genera una seduta FST-7 vera e verifica sia che il
generatore produca 4 esercizi sia che il validatore li accetti.

**Bug reale #2 — i dip erano esclusi dal motore per qualunque slot**: `dip_parallele`
(catalogo: tricipiti primario, petto+deltoide anteriore secondari — l'unico esercizio "a più
muscoli" del catalogo Push, esattamente quello descritto dall'utente) ha
`movement_pattern: 'horizontal_push'`, ma `PATTERN_PER_MUSCOLO.triceps` in `bodybuilding.ts`
accettava solo `'elbow_extension'`: l'esercizio non poteva mai essere scelto, indipendentemente
dalla struttura degli slot. Corretto aggiungendo `'horizontal_push'` ai pattern ammessi per
tricipiti (verificato: nessun altro esercizio del catalogo ha primary_muscles=triceps con quel
pattern, quindi l'aggiunta è mirata, non allarga il pool oltre i dip).

**Ristrutturazione Push** (`BASE_SLOTS.push`, `EXTRA_SLOTS.push`, `ordinaSlot` ramo push):
rimosso lo shoulder press pesante fisso come 3° slot (front_delts composto non è più nella
struttura di default). Nuovo ordine: 2× petto composto, alzate laterali (isolamento, 3°), dip
(tricipiti composto — allena anche petto/deltoide anteriore come secondari, 4°), tricipiti
isolamento (5°), 6° slot extra = petto isolamento o alzate laterali extra. Un front_delts
composto resta comunque disponibile SE dichiarato carenza esplicitamente (non più di default).

**Bug reale #3, scoperto verificando l'output reale dopo la ristrutturazione Push**: una
carenza front_delts dichiarata spariva silenziosamente, sostituita da un ripiego casuale. Causa:
`applicaPrioritaAssegnate` forza a isolamento (`compound: compoundCount < 2 && ...`) un nuovo
slot carenza quando la seduta ha già ≥2 composti — e Push ne ha sempre almeno 3 di default (2
petto + 1 dip) dopo la ristrutturazione. Il catalogo però **non ha nessun esercizio di
isolamento per i deltoidi anteriori** (solo military press/shoulder press/thruster, tutti
composti): lo slot isolamento forzato restava senza candidati. Corretto con
`MUSCOLI_SENZA_ISOLAMENTO = new Set(['front_delts'])`: per questo muscolo lo slot resta sempre
composto, sia nel ramo append sia nel ramo sostituzione di `applicaPrioritaAssegnate`.

**Tetto 2 esercizi spalle nelle carenze PPL** (`applicaPrioritaAssegnate`): sez. feedback
utente, "non devi rimuovere bicipiti per fare spazio ai deltoidi se già ci sono 2 esercizi di
deltoidi". Prima, con 3+ carenze spalle dichiarate (fronte/laterale/post.), la 3ª scippava lo
slot a un muscolo non ridondante come i bicipiti (unico slot sacrificabile rimasto non-
identitario). Corretto: appena `SHOULDER_MUSCLES` (front/lateral/rear delts) raggiunge 2
esercizi in seduta, una carenza spalle aggiuntiva resta fuori da oggi (la settimana la richiama
altrove, weeklyPlan.ts) invece di sacrificare un altro slot. Vale sia nel ramo append sia nel
ramo sostituzione.

**Ristrutturazione Legs** (`BASE_SLOTS.legs`, `EXTRA_SLOTS.legs`): 5° slot fisso ora è polpacci
(prima adduttori); 6° slot extra ora è glutei+adduttori (prima calves+adduttori, ridondante col
5° già fisso). 2 composti (quad+femorali) e 2 isolamenti (quad+femorali) restano invariati.
`lower`/`bro_legs` non toccati: l'utente ha parlato esplicitamente solo di "legs" in PPL.

**Avvicinamento CBum** (`prescrizioneCbum`, blocco 7d di `bodybuilding.ts`): sez. feedback
utente, "nel cbum devi dire avvicinamento". Il vero protocollo Top Set & Back-Off (stile CBum)
precede sempre la serie a cedimento con serie di riscaldamento specifico a carico crescente.
Ogni esercizio scelto ora diventa **4** voci tracciate consecutive (prima 2): Avvicinamento
1×12-15 (recupero breve), Avvicinamento 1×8-10, Top Set 1×6-8 @ RIR0, Back-Off 1×10-12 — tutte
sullo stesso `exercise_id`. Carico non calcolabile (nessun peso registrato da nessuna parte
dell'app, invariante già noto): resta un'indicazione testuale. Effetti a catena sistemati:
- `rimuoviDuplicati` (shared.ts) e il controllo duplicati di `validator.ts` riconoscevano solo
  `top_set`/`back_off` come coppia legittima; estesi a `avvicinamento`. `rimuoviDuplicati`
  semplificata: le note multi-serie (avvicinamento/top_set/back_off) non vengono più valutate
  affatto per la dedup (prima si tentava una chiave `id:note`, che avrebbe comunque collassato
  le due serie di avvicinamento identiche fra loro, stessa nota).
- `minimoAtteso` per `cbum_top_backoff` in `bodybuilding.ts` non è più una soglia fissa (`8`,
  pensata per 2 voci/esercizio): ora è `cbumBaseCount * 4`, calcolato sul numero di esercizi
  scelti PRIMA dell'espansione.
- Badge "Avvicinamento · carico crescente" aggiunto in `WorkoutPreview.tsx` e `Runner.tsx`,
  stesso meccanismo dei badge Top Set/Back-Off/FST-7 esistenti.

**Verificato**: 250 test verdi (247 + 1 nuovo test validatore FST-7 che riproduce esattamente il
bug segnalato dall'utente e verifica il fix, + 2 nuovi test generatore: dip_parallele
raggiungibile su 40 seed, nessuno shoulder press fisso su 20 seed), `tsc`/`eslint`/
`npm run build` puliti. Tre test esistenti aggiornati con commenti che spiegano il cambio di
comportamento voluto (ordine Push, struttura Legs, conteggio voci CBum).

**Non verificato in un browser reale**: stesso limite già documentato per FST-7/CBum in questo
Codespace — il wizard `Create.tsx` a 9 step richiede un utente Supabase autenticato, non
disponibile qui (a differenza di `/avvia`, che bypassa l'auth solo per `Runner.tsx`). Prossimo
passo suggerito in TODO.md: generare davvero FST-7/CBum dal wizard con un utente reale e
controllare a occhio badge Avvicinamento, assenza di shoulder press in Push, 5°/6° slot Legs.

## Aggiornamento stato — 2026-08-19 (pomeriggio): PPL Standard Biomeccanico a 6 Slot

Richiesta utente (specifica dettagliata, con `PPLSlotConfig` d'esempio e default per esercizio):
sostituire la composizione dinamica di Push/Pull/Legs con un template **fisso a 6 slot**, ognuno
con un ruolo anatomico preciso (muscolo + angolo/capo biomeccanico) pensato per alternare
distretti e creare un "cuscinetto di recupero attivo" fra un esercizio pesante e l'altro. Punto
più rilevante della spec: **sia Push sia Pull allenano bicipiti E tricipiti**, con angoli
complementari (capo lungo/allungamento su Push — es. Incline DB Curl, French Press —, capo
corto/laterale-mediale/accorciamento su Pull — es. Preacher Curl, Pushdown). Chiarito con 4
domande mirate prima di implementare (risposte tutte "consigliato"):
1. Gli slot sono fissi per ruolo (muscolo+angolo), l'esercizio scelto viene dal pool compatibile
   (attrezzatura/varietà) — il default della spec è la prima scelta preferita, non l'unica.
2. **Inversione voluta** del fix di stamattina ("una casa sola per muscolo": bicipiti solo Pull,
   tricipiti solo Push) — la nuova spec fa apposta il contrario.
3. Le carenze settimanali continuano a poter sostituire lo slot più ridondante, come già faceva
   `applicaPrioritaAssegnate`.
4. Si applica SOLO al sistema PPL (push/pull/legs) — Upper/Lower, Full Body, Bro Split invariati.

**Scoperta chiave**: il campo `focus_portion` (long_head/short_head/lateral_head/medial_head/
brachialis, aggiunto il 19/08 mattina per la Lagging Muscle Engine) mappa ESATTAMENTE sugli
angoli richiesti dalla spec — la migrazione di stamattina aveva già taggato `curl_inclinata_man`/
`bayesian_curl`=long_head, `curl_panca_scott`/`preacher_curl_macchina`=short_head, `french_press`/
`estensioni_sopra_testa`=long_head, `pushdown`=lateral_head: sono esattamente i default della
nuova spec. Nessuna migrazione catalogo nuova necessaria, solo plumbing nel generatore.

**Generatore** (`bodybuilding.ts`):
- `SlotDef` guadagna `preferredPortion?: FocusPortion`: uno slot fisso di template (non una
  carenza) può chiedere un capo specifico. La logica di selezione ora ha due rami — `isRichiamo`
  (carenza, usa `cfg.priority_portions` con rotazione settimanale, esistente) ha sempre priorità
  su `preferredPortion` (slot fisso di default) quando entrambi si applicano allo stesso slot.
- `BASE_SLOTS.push` (6 fissi): 2× petto composto, alzate laterali, dip (tricipiti composto — già
  ristrutturato stamattina), bicipiti isolamento (long_head), tricipiti isolamento (long_head).
- `BASE_SLOTS.pull` (6 fissi): 3× dorso composto (verticale, orizzontale 45°, orizzontale basso —
  il catalogo non distingue formalmente 45° da "basso", varietà garantita dall'esclusione
  duplicati), rear delt (face pull), tricipiti isolamento (lateral_head), bicipiti isolamento
  (short_head).
- `BASE_SLOTS.legs` (6 fissi): 2× quad composto (squat + leg press/hack — niente più composto
  femorali fisso), isolamento quad, isolamento femorali, glutei composto (hip thrust/stacco
  rumeno, hinge — chiude la catena posteriore DOPO le isolamenti, non subito dopo i composti),
  polpacci.
- `EXTRA_SLOTS.push/pull/legs` svuotati (mai più consultati: la base è già a 6 slot, il target è
  sempre 6). Avambracci non è più nel default di Pull (era nell'EXTRA_SLOTS di prima).
- `SPLIT_MUSCLE_POOL.push` += biceps, `.pull` += triceps.
- `ordinaSlot`: separati i rami `legs` (nuovo ordine) da `lower`/`bro_legs` (ordine invariato,
  fuori scope) e `pull` da `bro_back`/`back_body` (idem) — per non alterare split non toccati
  dalla spec pur condividendo la stessa funzione.

**Bug reale scoperto durante l'implementazione (non nella spec)**: con Push/Pull sempre a 6 slot
pieni, il protocollo Top Set & Back-Off (CBum) partiva da 6 esercizi base invece di 5 (il tetto
esisteva solo per FST-7), producendo 24 voci tracciate (6×4) — sempre oltre qualunque budget di
tempo ragionevole (validator.test.ts: 85 min stimati contro 69 max, sessione sempre invalida).
Corretto estendendo lo stesso pattern di troncamento già usato per FST-7 (`target`/`slot` tagliati
a `targetEsercizi('cbum_top_backoff')` = 5, sugli slot a priorità più alta dopo `ordinaSlot`) anche
a `cbum_top_backoff`.

**Validator/weeklyPlan**: `SPLIT_PRIMARY_MUSCLES.push` += biceps, `.pull` += triceps
(`validator.ts`, altrimenti ogni sessione di default veniva rigettata: "bicipiti non appartiene a
Push"). `splitAccogliePriorita` (`weeklyPlan.ts`, sistema `ppl`) invertito: bicipiti e tricipiti
ora compatibili sia con Push sia con Pull (era l'opposto, fix esplicito di stamattina — invertito
di proposito su richiesta utente, commento aggiornato per spiegare perché).

**Punto 3 della spec ("Slot-Restricted Swap") già esistente, non serviva codice nuovo**:
`findExerciseReplacements` (`replacement.ts`) filtra già le alternative per stesso
`focus_portion` dell'esercizio originale quando noto (pass 1), con fallback progressivo solo se
non ci sono abbastanza candidati (mai un vicolo cieco per l'utente) — costruito durante la
Lagging Muscle Engine di stamattina. Verificato che si applica automaticamente anche ai nuovi
slot fissi bicipiti/tricipiti di Push/Pull, senza bisogno di toccare `replacement.ts`.

**Non toccato, per scelta esplicita**: `lower`/`bro_legs`/`bro_back`/`back_body` (fuori scope,
solo sistema PPL); Pull non ha un vero equivalente del "dip a 3 muscoli" di Push — l'utente non
ha dato un esempio concreto per Pull, quindi la struttura a 3 composti dorso resta così com'è
invece di inventare uno slot non richiesto.

**Verificato**: 252 test verdi (250 + 2 nuovi: default Push bicipiti/tricipiti long_head, tetto
di 6 esercizi mai superato su Push/Pull/Legs anche con carenze al massimo), più 4 test esistenti
riscritti con commenti che spiegano il cambio di comportamento voluto (non un bug). `tsc`/
`eslint`/`npm run build` puliti.

**Non verificato in un browser reale**: stesso limite già noto in questo Codespace (nessun utente
Supabase autenticato disponibile per il wizard `Create.tsx`).

## Aggiornamento stato — 2026-08-19 (sera): rimossa la policy sempre/mai su corpo libero/elastici

Bug segnalato dall'utente, mid-turn durante il lavoro sul PPL Standard a 6 Slot: la scelta
"corpo libero: sempre/mai/solo finisher" ed "elastici: sempre/mai/solo finisher" (Create.tsx
Step 7) escludeva esercizi utili come i dip **anche quando l'attrezzatura richiesta era
disponibile davvero** — `isExerciseAllowed` applicava questo filtro globale IN AGGIUNTA a
`isExerciseAvailable` (che già verifica se l'utente ha `parallel_bars`/`resistance_bands` in
inventario), rendendoli ridondanti quando concordi ma silenziosamente distruttivi quando in
conflitto (es. utente ha le parallele nell'inventario ma `bodyweight_policy: 'never'`: il dip
spariva comunque). Richiesta esplicita: rimuovere del tutto questa sezione; tenere solo
"preferenza esercizio" (avanzate, dichiarazione esplicita "voglio questo esercizio") ed
"esclusione esercizio" (dichiarazione esplicita "mai questo esercizio") — già esistenti in
Create.tsx Step 7 — e affidarsi allo swap "Sostituisci" nella scheda (già raggruppato per
attrezzo: Manubri&Panca/Corpo Libero&Sbarra/Cavi&Elastici/Macchine&Guidati, `WorkoutPreview.tsx`
`SWAP_EQUIPMENT_GROUPS`, già esistente) per lasciare all'utente la scelta fra alternative a pari
effort (es. trazioni alla sbarra ↔ lat machine ↔ trazioni assistite con elastico).

**Rimosso interamente** (nessun backward-compat shim, il campo era davvero morto):
- `ExercisePolicy` type e `EXERCISE_POLICY_LABELS` (`types/index.ts`).
- `bodyweight_policy`/`elastic_policy` da `ExercisePreference` (`types/index.ts`) — i programmi
  già salvati su Supabase (config jsonb) portano ancora questi campi extra nel JSON: innocuo,
  ignorati a runtime, nessuna migrazione necessaria.
- `bodyweightPolicy`/`elasticPolicy`/il parametro `placement` da `RuntimePreferences`/
  `isExerciseAllowed`/`filterExercisesByPreferences` (`engine/preferences.ts`) — la funzione ora
  controlla solo `excludedExerciseIds`. `ExercisePlacement`/`preferencePlacementForMode` rimossi
  con loro: servivano solo a decidere la policy 'finisher_only', ora inutile.
- `placement` da `findExerciseReplacements` (`engine/replacement.ts`), passato a
  `isExerciseAllowed`.
- Sezione UI "Corpo libero"/"Elastici" e componente `Policy` in Create.tsx Step 7, sostituiti da
  una nota che spiega il nuovo comportamento (swap nella scheda). `setPolicy` rimosso.
- Riferimenti in `WorkoutPreview.tsx` (swap), `weeklyPlan.ts` (warning `mode_density` legato a
  `bodyweight_policy === 'never'`: la precondizione non può più verificarsi, corpo libero non è
  più disattivabile), `deepseek.ts` (prompt DeepSeek, sia planner sia generazione diretta).

**Cosa NON è cambiato**: `isExerciseAvailable` (`equipment.ts`) resta l'unico filtro di
disponibilità reale, basato sull'inventario attrezzatura dichiarato dall'utente
(`parallel_bars`, `resistance_bands`, ecc.) — è quello corretto e resta intatto. Lo swap
"Sostituisci" già raggruppava per attrezzo e già rispettava `focus_portion` per le alternative
(Lagging Muscle Engine, stessa mattina): nessun codice nuovo necessario lì, solo la rimozione
del filtro ridondante a monte.

**Verificato**: 250 test verdi (rimossi 3 test sulla policy ormai inesistente in
`engine.test.ts`, sostituiti con 1 test sulla sola esclusione esplicita; aggiornati i fixture di
preferenze in `weeklyProgram.test.ts`/`validator.test.ts`/`replacement.test.ts`/
`bodybuilding.test.ts` che dichiaravano `bodyweight_policy`/`elastic_policy`), `tsc`/`eslint`/
`npm run build` puliti.

**Non verificato in un browser reale**: stesso limite già noto in questo Codespace.

## Aggiornamento stato — 2026-08-19 (notte): bug reale grave in Create.tsx — le carenze sostituivano interamente lo split settimanale

Segnalato dall'utente testando in produzione (PPL 5 giorni, carenze alzate laterali+bicipiti+
tricipiti, protocollo CBum): "la prima sessione è Spinta e mi porta le alzate laterali, non mi
porta esercizi di spinta" + "la dinamica di CBum non cambia dal PPL, prima era diversa ed era
corretta". Riprodotto esattamente con uno script diretto prima di correggere.

**Causa reale (bug pre-esistente, non introdotto oggi — presente almeno dal commit `6425c3e`,
17/08, "fix: separate BB targets from weak points")**: in `Create.tsx` (`generateDay`),
`todayTargets` (che alimenta `target_muscles` in TUTTI i generatori: bodybuilding, forza,
crossfit, hybrid) era `session.priority_muscles` per qualunque programma **non**
`single_session` — le stesse carenze già passate correttamente a `priority_muscles`/
`todayPriorities`. Con `target_muscles` non vuoto, `generaBodybuilding` imbocca
`buildCustomTargetSlots` (pensato SOLO per la sessione singola a gruppi scelti esplicitamente
dall'utente) invece di `BASE_SLOTS`/`applicaPrioritaAssegnate`: la seduta viene ricostruita da
zero usando SOLO i muscoli in `target_muscles`, niente più petto/dorso. Il bug era già presente
da giorni ma è diventato molto più visibile oggi pomeriggio: da quando bicipiti/tricipiti sono
compatibili sia con Push sia con Pull (PPL Standard a 6 Slot), quasi ogni seduta della settimana
ha `session.priority_muscles` non vuoto, quindi il bug scatta quasi sempre invece che solo
occasionalmente.

**Riprodotto con script diretto** (`generateWeeklyProgram` + `generaBodybuilding`, PPL 5 giorni,
carenze `['lateral_delts','biceps','triceps']`, protocollo CBum): con `target_muscles:
priority_muscles` (bug) Push diventa `alzate_laterali, curl_inclinata_man, estensione_tricipiti,
alzate_laterali_elastico` — zero petto, alzate laterali duplicate (il riempimento generico di
`buildCustomTargetSlots` ripete i target quando sono troppo pochi per 6 slot). Con
`target_muscles: []` (fix) Push torna quella corretta: 2 panca, alzate laterali, dip, bicipiti —
tutti con avvicinamento/top set/back off del protocollo CBum regolarmente presenti. Questo
spiega **anche** il secondo report ("CBum non cambia dal PPL"): la sessione degenerata del bug,
dominata da isolamenti carenza, "sembra sempre uguale" a prescindere dal protocollo — non è che
CBum non applicasse le sue serie, è che la selezione degli esercizi sotto era già rotta.

**Fix**: `todayTargets` in `Create.tsx` è ora sempre `[]` per un programma non `single_session`
(commento esteso sul posto che spiega perché). Aggiunto un test in `bodybuilding.test.ts` che
blocca il caso specifico (target_muscles=priority_muscles → petto sparisce) e uno che aggiorna
il test end-to-end esistente per passare esplicitamente `target_muscles: []`, come fa ora
davvero `Create.tsx`.

**Tre richieste UX nello stesso messaggio, tutte implementate**:
- Tasto "Indietro" mancante SOLO nello step 1 del wizard (tutti gli altri step 2-9 lo avevano
  già, verificato leggendo `StepNav`): ora step 1 torna alla Home (`navigate('/')`), sia via
  bottone sia via swipe. Lo swipe-per-tornare-indietro (`onSwipeRight={goBack}`, convenzione già
  usata identica in tutti gli altri step) NON è stato invertito verso sinistra come letteralmente
  chiesto ("swipe verso sinistra"): avrebbe reso lo step 1 incoerente con gli altri 8 step, che
  usano tutti swipe-destra-per-tornare-indietro. Da confermare con l'utente se vuole davvero
  invertire la direzione ovunque.
- "Se scelgo programma settimanale, la pagina dopo non deve chiedermelo di nuovo": la Home
  (`HomeDashboard.tsx`) già passa `program_kind` come query param (`/crea?program_kind=...&
  fresh=1`) quando l'utente sceglie da lì, ma lo step 2 del wizard (la stessa domanda) veniva
  comunque mostrato. Aggiunto `skipKindStep` (vero solo quando si arriva fresh da Home con
  `program_kind` esplicito in URL): `stepAfter`/`stepBefore` saltano lo step 2 in entrambe le
  direzioni solo in quel caso — un ingresso diretto sull'URL senza quel parametro può ancora
  scegliere.

**Verificato**: 251 test verdi (250 + 1 nuovo test mirato sul bug target_muscles), `tsc`/
`eslint`/`npm run build` puliti.

**Non verificato in un browser reale**: l'utente ha offerto credenziali di produzione per un
test live, ma non ho un tool di automazione browser disponibile in questo ambiente (nessun
Playwright installato nel progetto, nessun tool MCP di navigazione nella lista strumenti di
questa sessione) — non ho tentato un test live per non rischiare di usare le credenziali senza
poterle davvero sfruttare. Prossimo passo: l'utente deve riverificare in produzione dopo il
deploy di questo fix, in particolare se il report "CBum non cambia dal PPL" è davvero risolto
o se c'è dell'altro.

## Aggiornamento stato — 2026-08-21: dip Push vincolato a dip_parallele (non più casuale) + tasto "Torna alla Settimana" dopo il salvataggio

Due bug segnalati da Rossi in chat (non da script di riproduzione, testati direttamente in produzione/uso reale).

**Bug reale #1 — il dip di Push era ancora casuale nonostante il fix del 19/08 mattina**: quel fix
aveva aggiunto `'horizontal_push'` a `PATTERN_PER_MUSCOLO.triceps`, ma quel filtro agisce a livello
di *muscolo*, non di singolo slot — verificato sulla fixture catalogo
(`src/generators/__tests__/fixtures/exercises.json`): `dip_panca` ha `movement_pattern:
'elbow_extension'` (già ammesso da sempre) e `dip_parallele` ha `movement_pattern: 'horizontal_push'`
(ammesso dal 19/08). Con `PATTERN_PER_MUSCOLO.triceps = ['elbow_extension', 'horizontal_push']`
**entrambi** passavano il filtro di coerenza, e la scelta finale fra i due restava affidata al
sorteggio fra i primi 3 candidati per fatica (`testa[Math.floor(random() * testa.length)]`) — il
motore non aveva mai smesso di scegliere a caso, aveva solo smesso di escludere sempre
`dip_parallele`. Corretto aggiungendo `preferredPatterns: ['horizontal_push']` allo slot 4 di
`BASE_SLOTS.push` (non al filtro globale per muscolo): il pool si restringe ai soli esercizi con
quel pattern esatto, e nel catalogo solo `dip_parallele` lo ha — `dip_panca` resta candidato per
altri slot triceps (es. isolamento) ma non più per questo. Aggiunto anche `maxSets: 3` sullo
stesso slot (prima 4, come tutti i compound): sez. feedback utente, "le 4 serie standard erano
eccessive per uno slot che funge da recupero attivo dopo due panche pesanti" — nuovo campo
opzionale `SlotDef.maxSets`, applicato nel calcolo della prescrizione solo quando il protocollo non
è FST-7 (FST-7 ha già una sua prescrizione dedicata, non tocca `maxSets`).

**Bug reale #2 — il programma settimanale si perdeva dopo aver salvato una giornata**: dal modal
"Allenamento Salvato!" (`WorkoutPreview.tsx`) le uniche due uscite erano "Vai alla Libreria
Salvati" e "Torna alla Home" — nessuna delle due riportava alla settimana in corso
(`weeklyProgram`, tenuta in `sessionStorage`), quindi chi stava costruendo un programma multi-
giorno la perdeva di vista non appena salvava una seduta. Aggiunto un pulsante "📅 Torna alla
Settimana" (`naviga('/crea')`), sia in cima alla pagina di anteprima sia nel modal di conferma
salvataggio, visibile solo quando `weeklyProgram.config.program_kind === 'program'` e
`weeklyProgram.week.length > 1` (cioè un vero programma multi-giorno, non una seduta singola). Il
bottone "Vai alla Libreria Salvati" diventa stilisticamente secondario (bordo invece di sfondo
pieno) quando quello nuovo compare, per non avere due call-to-action ugualmente primarie.

**Verificato**: `tsc --noEmit` pulito, **251/251 test verdi** (suite intera, non solo il file
toccato — invariata rispetto al 19/08 tranne il test riscritto sotto), `eslint` pulito sui file
toccati, `npm run build` pulita. Il test `bodybuilding.test.ts` sul dip (sez. "Push senza shoulder
press fisso...") è stato riscritto: prima verificava solo che `dip_parallele` fosse *raggiungibile*
su 40 seed (troppo debole: passava anche se metà delle volte usciva `dip_panca`), ora verifica per
ogni seed che l'esercizio scelto sia sempre `dip_parallele` e abbia sempre al massimo 3 serie.

**Non verificato in un browser reale**: stesso limite di sempre in questo Codespace (nessun utente
Supabase autenticato disponibile per il wizard `Create.tsx`/`WorkoutPreview.tsx`). Prossimo passo:
Rossi deve generare un Push vero e controllare a occhio che lo slot 4 sia sempre il dip alle
parallele con 3 serie, e provare il salvataggio di una giornata dentro un programma settimanale
multi-giorno per vedere comparire il nuovo pulsante "Torna alla Settimana".

**Lavoro consegnato e mergiato su `main`** (squash commit `94070fb`, 21/08): la PR #30 è stata
mergiata, Vercel ha buildato e pubblicato in produzione con successo (check GitHub: Vercel
success sul commit `94070fb`). **Non verificato personalmente aprendo il link**: restrizioni di
rete di questa sessione impediscono l'accesso a `gymbuilder-lemon.vercel.app` da qui — il
prossimo LLM (o Rossi) deve aprire il sito e controllare a occhio prima di considerare la
verifica completa, non fidarsi solo del pannello verde di Vercel.
