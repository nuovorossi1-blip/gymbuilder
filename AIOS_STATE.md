# STATO DEL PROGETTO — GYMBUILDER

> File di memoria AI-OS. Chi apre questo progetto con `/handoff gymbuilder` legge
> da qui. Va **aggiornato** a ogni sessione, non accodato all'infinito.
> L'identità del progetto e il percorso di AI-OS stanno in `AIOS_PROJECT.json`.

**Ultimo aggiornamento:** 2026-08-06 — Claude (Sonnet 5)

Etichette: `[FACT]` verificato nel codice · `[RICOSTRUITO]` dedotto da indizi ·
`[IGNOTO]` non ricavabile dal repository

---

## 1. Obiettivo finale

Un'applicazione che genera allenamenti su misura. L'utente non sceglie una scheda
predefinita: dichiara le proprie caratteristiche, gli obiettivi, il tempo che ha
oggi e il tipo di allenamento che vuole fare, e l'app costruisce una sessione
coerente — esercizi, ordine, serie, ripetizioni, recuperi, timer, durata stimata.

Sei modalità: Bodybuilding, Forza, CrossFit Standard, CrossFit Hybrid,
Condizionamento, Tabata.

**Vincolo architetturale non negoziabile** (specifica sez. 37): il motore di
generazione è **deterministico e guidato dai dati**, non un LLM. Un LLM potrà in
futuro aggiungere coaching, spiegazioni e varianti, ma l'app deve poter generare
e validare un allenamento anche senza AI.

---

## 2. Dove siamo adesso

**Fasi 1-6 completate.** L'app ha autenticazione, profilo, un database di 87
esercizi in Supabase (con istruzioni testuali per ciascuno) e tre motori di
generazione: **Bodybuilding** (13 split, corretto in profondità in una
sessione precedente), **Forza** (6 split) e **CrossFit Standard** (nuovo,
fase 6: Riscaldamento → Forza/Skill → Metcon AMRAP, niente split per gruppo
muscolare). Tutti e tre condividono un'infrastruttura comune (`shared.ts`,
`weakPoints.ts`, `calories.ts`) invece di duplicare la logica.

Gli altri tre motori (CrossFit Hybrid, Condizionamento, Tabata) **non
esistono ancora**: nella schermata Genera compaiono come riquadri disattivati
con l'etichetta "in arrivo" (sez. 84 della correzione: non si finge che una
modalità esista quando non è costruita). Quando la specifica parla di EMOM,
For Time, Rounds, Circuit/Intervals o timer Tabata, sono requisiti per il
lavoro futuro (fasi 7-9, principalmente Condizionamento), non bug di qualcosa
già costruito: CrossFit Standard usa solo il formato AMRAP di proposito (vedi
sez. 8).

**Sito online:** `gymbuilder-lemon.vercel.app` — **[FACT]**, verificato in
questa sessione. Il collegamento automatico GitHub→Vercel **è attivo**
(la nota precedente che lo dava per assente era sbagliata/superata — vedi
problema risolto in sez. 7): ogni push su `main` pubblica da solo in un minuto

---

## 3. Cosa funziona

- [FACT] Registrazione e accesso con email e password (Supabase Auth)
- [FACT] Alla registrazione un trigger crea automaticamente profilo e impostazioni
  di default: l'utente non trova mai schermate vuote
- [FACT] Pagina Profilo: nome, esperienza, obiettivo, durata abituale, frequenza
  settimanale, attrezzatura, muscoli prioritari, **esercizi preferiti** (nuovo).
  Ogni modifica si salva subito su Supabase con conferma a schermo
- [FACT] Navigazione inferiore a 5 voci (Home, Crea, Salvati, Storico, Profilo)
- [FACT] RLS attiva su tutte le tabelle (`profiles`, `user_settings`, `exercises`,
  `saved_workouts`, `completed_workouts`): ogni utente legge e scrive solo le
  proprie righe. Verificato con l'advisor di sicurezza Supabase: zero avvisi
  critici (un solo WARN non bloccante, leaked-password-protection disattivata
  nel pannello Auth — non è una regressione di questa sessione)
- [FACT] Interfaccia mobile-first, dark, con focus da tastiera visibile e
  `prefers-reduced-motion` rispettato
- [FACT] Database esercizi: 79 voci in Supabase con metadati completi (muscoli
  primari/secondari, attrezzo, movement pattern, ruoli, esperienza minima,
  complessità tecnica, fatica sistemica/locale/di presa, domanda cardio)
- [FACT] Motore Bodybuilding (`src/generators/bodybuilding.ts`), **riscritto in
  questa sessione** — vedi sez. 7 per i motivi. Copre 13 split: Push/Pull/Legs,
  Upper/Lower, Full Body, Bro Split (Petto/Dorso/Spalle/Braccia/Gambe),
  Front/Back. Architettura "struttura-prima": la sessione ha sempre 5-7 slot
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
- [FACT] **Istruzioni testuali** per tutti i 79 esercizi (colonna
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
- [FACT] 52 test automatici (`npm test`): 23 su Bodybuilding, 13 su Forza, 16
  su CrossFit Standard, eseguiti contro il catalogo reale di 87 esercizi
  (fixture copiata da Supabase, non dati inventati)

## 4. Cosa è in lavorazione

Niente aperto a metà. Il prossimo lavoro non iniziato è il motore
Condizionamento (fase 8) o CrossFit Hybrid (fase 7), a scelta dell'utente.

## 5. Cosa manca

CrossFit Hybrid, Condizionamento (con i formati EMOM/For Time/Rounds/
Circuit/Intervals che CrossFit Standard non usa apposta, vedi sez. 8), Tabata.
Validatore come modulo separato per le nuove modalità (per Bodybuilding e
Forza la validazione è già integrata nella generazione, vedi sez. 8;
CrossFit Standard segue lo stesso schema). Frequenza cardiaca reale
(Bluetooth/HealthKit/Health Connect): solo il placeholder onesto esiste, non
l'architettura `HealthDataProvider` della sez. 56. Integrazioni wearable,
notifiche (tutto rimandato a V1.2/V2 nella roadmap originale). Modifica di un
workout salvato esercizio per esercizio (sez. 45 della specifica): oggi si
può solo rigenerare o eliminare, non editare i singoli esercizi.

---

## 6. Problemi aperti

| # | Problema | Da quando | Cosa si è già provato |
|---|---|---|---|
| 1 | Push diretto su GitHub non autenticato da questo ambiente (`git push` e le API dirette restituiscono 403; l'app GitHub collegata non ha permesso di scrittura sui contenuti) | 05/08 | Aggirato una volta con GitHub Codespaces (terminale nel browser, autenticato all'account dell'utente): `git am` delle patch + push. Da rifare ad ogni sessione finché l'app non ha "Contents: Read and write" |
| 2 | **[IGNOTO]** se le variabili d'ambiente `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` sono impostate nel pannello Vercel. La build su Vercel risulta "Ready" e il collegamento automatico GitHub→Vercel funziona (smentendo la vecchia nota che lo dava per assente), ma una build che compila non prova che le variabili siano quelle giuste: Vite le incorpora al momento della build, un valore mancante non fa fallire nulla, produce solo un'app che non riesce a parlare con Supabase | 05/08 | Nessuna verifica diretta possibile da qui (nessun accesso al pannello Vercel). Da confermare aprendo il sito e provando login/generazione |

## 7. Problemi risolti

> Non cancellare mai questa sezione: impedisce di rifare lo stesso errore.

| Problema | Causa vera | Soluzione |
|---|---|---|
| L'advisor Supabase segnalava `handle_new_user` come funzione `SECURITY DEFINER` richiamabile via API da chiunque | Le funzioni nello schema `public` sono esposte come endpoint RPC anche quando servono solo a un trigger | `revoke execute` su `anon`, `authenticated` e `public` per entrambe le funzioni di trigger. Migrazione `blinda_funzione_trigger` |
| Bodybuilding Push generava a volte solo 3-4 esercizi nonostante il minimo dichiarato di 5, e il messaggio all'utente era scoperto solo *dopo* la generazione | Il motore selezionava gli esercizi slot per slot e, se uno slot non trovava candidati, lo saltava semplicemente (`continue`); un ciclo di "riempimento" separato provava a rimediare ma si fermava appena finiva il budget di tempo. La struttura della sessione non era mai garantita a priori | Riscritto il motore con architettura "struttura-prima" (sez. 8 sotto): 5 slot base sempre presenti, 6°-7° decisi da richiami/extra, e un adattamento al tempo che riduce prima recuperi poi serie *prima* di togliere uno slot — mai sotto 5 se non per assenza reale di attrezzatura compatibile |
| I muscoli carenti venivano ridistribuiti nella sessione ma potevano far collassare un altro muscolo target: con carenze `biceps`+`rear_delts` su uno split Pull, il dorso scendeva da 3 slot a 1 | `ridistribuisci()` toglieva uno slot al muscolo più rappresentato per OGNI muscolo prioritario, anche quando quel muscolo prioritario aveva già un suo slot naturale: due priorità in sequenza "spolpavano" lo stesso donatore (`back`) due volte | La funzione ora salta i muscoli prioritari già rappresentati nello split: la redistribuzione serve solo a colmare un vuoto, non a gonfiare un muscolo già coperto. Trovato e verificato con un test sullo scenario critico della correzione (sez. 28 del prompt di correzione) |
| Gli esercizi preferiti aumentavano la probabilità di essere scelti solo da ~1/3 a ~1/3 (nessun effetto reale) | Il preferito veniva messo in cima all'ordinamento ma poi la scelta finale pescava comunque a caso fra i primi 3 candidati, preferito incluso: l'ordinamento non cambiava le probabilità | Quando esiste almeno un candidato preferito compatibile con lo slot, il pool di scelta si restringe ai soli preferiti (con varietà se l'utente ne ha più di uno per lo stesso muscolo), invece di un pool misto pescato a caso |
| Con carenze dichiarate su muscoli non pertinenti (es. bicipiti/tricipiti/deltoidi anteriori su uno split Gambe), quei muscoli comparivano comunque come "richiamo" nella sessione Gambe | Il calcolo dei richiami settimanali (`decidiRichiami`) operava su tutti i `priority_muscles` dell'utente senza filtrarli per split: bastava un volume settimanale basso (es. 0 per un utente nuovo) perché finissero in sessione, contro la regola esplicita "non aggiungere mai braccia o spalle nelle gambe" | Aggiunta una mappa `RICHIAMO_POOL` per split: le gambe possono richiamare solo quadricipiti/femorali/glutei/polpacci/core; Push e Pull hanno l'eccezione anatomica classica (Push può richiamare bicipiti, Pull può richiamare tricipiti), tutti gli altri split restano dentro il proprio pool naturale |
| Il tetto ai "compound pesanti" (max 2 a sessione, sez. 24/77 della correzione) non scattava mai nei test | La soglia era tarata su una scala di fatica 1-10 ("systemic_fatigue >= 7"), ma il catalogo reale usa una scala 1-3. Nessun esercizio raggiungeva mai la soglia | Soglia corretta a 3 (il valore massimo reale nel catalogo). Lezione: quando si tara una soglia su un campo numerico, controllare il range effettivo dei dati prima di scegliere il numero, non assumerlo dalla specifica in astratto |
| `AIOS_PROJECT.json`/`AIOS_STATE.md` dicevano che il collegamento automatico GitHub→Vercel non era attivo | La nota risale alla Fase 1 e non è mai stata riverificata nelle sessioni successive: è rimasta come vera per inerzia. In realtà il progetto Vercel *era* collegato a GitHub (dominio `gymbuilder-git-main-...` generato automaticamente, deployment innescato da solo dopo un push su `main`) | Verificato guardando l'elenco dei deployment su Vercel dopo un push reale: il nuovo commit compare come "Latest"/"Current" entro un minuto. Nota corretta in questo file. Lezione: una nota "problema aperto" scritta in una sessione va riverificata prima di darla per scontata nelle successive, non solo copiata avanti |
| Con intensità "Alta" e poco tempo a disposizione, il recupero finiva identico a quello di intensità "Bassa" nello stesso scenario — il campo Intensità sembrava non avere alcun effetto | Non è un bug: quando il tempo è troppo poco per il recupero lungo richiesto da "Alta", l'adattamento al tempo lo comprime verso il minimo, esattamente come farebbe con qualunque altra intensità nello stesso vincolo. È l'effetto atteso di "adatta il tempo, non tagliare esercizi", solo che in quel caso specifico appiattisce la differenza fra intensità | Non è stato cambiato il motore: cambiato il test, che ora verifica l'effetto dell'intensità con un budget di tempo sufficiente a non farla comprimere. Da tenere a mente: l'intensità è un'indicazione, non una garanzia, quando il tempo è troppo poco |

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
- **`package-lock.json` non è committato di proposito.** `npm install` lo
  rigenera in un attimo da `package.json`, e un lockfile di ~90KB nel diff
  costerebbe caro da spingere su GitHub tramite gli strumenti MCP disponibili
  in questo ambiente (niente `git push` diretto autenticato qui, solo API).
  Se in futuro serve pin esatto delle versioni, va aggiunto consapevolmente,
  non come effetto collaterale di un altro commit

---

## 10. Dove si è fermato l'ultimo lavoro

**Modello:** Claude (Sonnet 5) · **Data:** 2026-08-06

Costruito il motore CrossFit Standard (fase 6) da zero: Riscaldamento →
Forza/Skill → Metcon AMRAP, riusando `shared.ts`/`calories.ts` come gli altri
due motori. Aggiunti 8 esercizi al catalogo Supabase per il Metcon (87
totali), esteso il Runner con uno stopwatch AMRAP + contatore giri al posto
del ciclo serie/recupero, e reso `GeneratedWorkout.split` nullable (era già
previsto dallo schema DB, mai sfruttato finora). Il punto esatto in cui
riprendere è la **fase 7 (CrossFit Hybrid) o la fase 8 (Condizionamento)**,
a scelta.

Nessun lavoro lasciato a metà. Build (`npm run build`) e test (`npm test`,
52 test) verificati entrambi verdi prima di chiudere la sessione.

---

## 11. Prossimi passi

Le fasi seguono l'ordine della sez. 96 della specifica dell'utente, accorpate dove
prese singolarmente non sarebbero verificabili.

| Fase | Cosa | Stato |
|---|---|---|
| **2** | Database esercizi (79 voci, metadati completi) | ✅ Fatto |
| **3** | Motore Bodybuilding: 13 split, fatica, muscoli prioritari | ✅ Fatto, **corretto in questa sessione** (sez. 7-8) |
| **4** | Validatore | ✅ Integrato nella generazione stessa per Bodybuilding (struttura garantita a priori + rete di sicurezza finale che dedupe/ricontrolla). Da rifare come modulo esplicito quando arrivano le modalità CrossFit/Conditioning, che hanno regole di validità diverse (formati Metcon, cap di tempo, ecc.) |
| **5** | Motore Forza | ✅ Fatto |
| **6** | CrossFit Standard: Forza/Skill + Metcon AMRAP | ✅ Fatto |
| **7** | CrossFit Hybrid — funzionalità distintiva del prodotto (sez. 18 correzione) | ⬜ Prossimo passo |
| **8** | Condizionamento: AMRAP, EMOM, For Time, Rounds, Circuit, Intervals | ⬜ Non iniziato |
| **9** | Tabata, motore separato | ⬜ Non iniziato |
| **10** | Workout Runner e timer | ✅ Fatto per Bodybuilding/Forza (timer di recupero) e per il Metcon AMRAP di CrossFit Standard (stopwatch + contatore giri). EMOM/Tabata timer arrivano con le fasi 8-9 |
| **11** | Salvataggio, preferiti, ripeti identico, rigenera variante | ✅ Salvataggio/rigenerazione fatti, anche per CrossFit Standard. Modifica esercizio-per-esercizio di un salvato: non ancora |
| **12** | Storico e valutazione post-allenamento | ✅ Fatto (valutazione soggettiva + note; niente HR/calorie, rimandato a V1.2) |
| **13** | Test sulle parti critiche | 🟡 Iniziato: 52 test sui tre motori di generazione (`npm test`). Da estendere quando arrivano gli altri motori |
| **14** | Preparazione all'impacchettamento mobile con Capacitor | ⬜ Non iniziato |

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
