# STATO DEL PROGETTO — GYMBUILDER

> File di memoria AI-OS. Chi apre questo progetto con `/handoff gymbuilder` legge
> da qui. Va **aggiornato** a ogni sessione, non accodato all'infinito.
> L'identità del progetto e il percorso di AI-OS stanno in `AIOS_PROJECT.json`.

**Ultimo aggiornamento:** 2026-08-05 — Claude Opus 4.5

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

**Fase 1 completata.** L'applicazione è online e funzionante: ci si registra, si
accede, si imposta il proprio profilo di allenamento e i dati restano salvati.
I motori di generazione non esistono ancora — è il lavoro delle fasi 4-11.

**Sito online:** vedi `deploy.site_url` in `AIOS_PROJECT.json`

---

## 3. Cosa funziona

- [FACT] Registrazione e accesso con email e password (Supabase Auth)
- [FACT] Alla registrazione un trigger crea automaticamente profilo e impostazioni
  di default: l'utente non trova mai schermate vuote
- [FACT] Pagina Profilo: nome, esperienza, obiettivo, durata abituale, frequenza
  settimanale, attrezzatura, muscoli prioritari. Ogni modifica si salva subito
  su Supabase con conferma a schermo
- [FACT] Navigazione inferiore a 5 voci (Home, Crea, Salvati, Storico, Profilo)
- [FACT] Home mostra il riepilogo reale delle impostazioni lette dal database
- [FACT] RLS attiva su `profiles` e `user_settings`: ogni utente legge e scrive
  solo le proprie righe. Verificato con l'advisor di sicurezza Supabase: zero avvisi
- [FACT] Interfaccia mobile-first, dark, con focus da tastiera visibile e
  `prefers-reduced-motion` rispettato

## 4. Cosa è in lavorazione

Niente. La fase 1 è chiusa, la 2 non è iniziata.

## 5. Cosa manca

Tutto il resto della specifica: database esercizi, sei motori di generazione,
validatore, anteprima, runner con i timer, salvataggio, preferiti, storico.

---

## 6. Problemi aperti

| # | Problema | Da quando | Cosa si è già provato |
|---|---|---|---|
| 1 | Il collegamento automatico GitHub → Vercel non è attivo: ogni pubblicazione va rifatta a mano | 05/08 | Va fatto una volta dal pannello Vercel (Import Project → GitHub → gymbuilder). Non è automatizzabile via API |
| 2 | Le variabili d'ambiente non sono impostate nel pannello Vercel: la build attuale ha i valori inclusi al momento della pubblicazione | 05/08 | Vanno inserite in Vercel prima di collegare GitHub, altrimenti la prima build automatica fallisce |

## 7. Problemi risolti

> Non cancellare mai questa sezione: impedisce di rifare lo stesso errore.

| Problema | Causa vera | Soluzione |
|---|---|---|
| L'advisor Supabase segnalava `handle_new_user` come funzione `SECURITY DEFINER` richiamabile via API da chiunque | Le funzioni nello schema `public` sono esposte come endpoint RPC anche quando servono solo a un trigger | `revoke execute` su `anon`, `authenticated` e `public` per entrambe le funzioni di trigger. Migrazione `blinda_funzione_trigger` |

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

---

## 10. Dove si è fermato l'ultimo lavoro

**Modello:** Claude Opus 4.5 · **Data:** 2026-08-05

Fase 1 chiusa e pubblicata. Il punto esatto in cui riprendere è la **fase 2 del
piano qui sotto: il database degli esercizi**, che è il presupposto di tutti i
motori di generazione — senza quello non si può generare niente.

Nessun lavoro lasciato a metà.

---

## 11. Prossimi passi

Le fasi seguono l'ordine della sez. 96 della specifica dell'utente, accorpate dove
prese singolarmente non sarebbero verificabili.

| Fase | Cosa | Perché serve |
|---|---|---|
| **2** | Database esercizi: tabella `exercises` con i metadati della sez. 28 (muscoli primari e secondari, attrezzo, movement pattern, ruolo, fatica sistemica/locale/di presa, complessità tecnica, domanda cardiovascolare) e un primo popolamento reale | È la fonte di verità di tutto. Nessun motore può esistere prima |
| **3** | Motore Bodybuilding: split PPL, Upper, Lower, Full Body, Bro Split, con regole di distribuzione proprie per ciascuno (sez. 16), gestione della fatica (sez. 12) e muscoli prioritari (sez. 6) | È il motore più usato e definisce l'architettura che gli altri riusano |
| **4** | Validatore (`WorkoutValidationEngine`, sez. 36) e anteprima dell'allenamento | Un allenamento generato ma non validato non va mostrato |
| **5** | Motore Forza | |
| **6** | CrossFit Standard | |
| **7** | CrossFit Hybrid — funzionalità distintiva del prodotto (sez. 19-23) | |
| **8** | Condizionamento: AMRAP, EMOM, For Time, Rounds, Circuit, Intervals | |
| **9** | Tabata, motore separato | |
| **10** | Workout Runner e timer (sez. 40-44) | |
| **11** | Salvataggio, preferiti, ripeti identico, rigenera variante | |
| **12** | Storico e valutazione post-allenamento | |
| **13** | Test sulle parti critiche (sez. 80-82) | |
| **14** | Preparazione all'impacchettamento mobile con Capacitor (sez. 85) | |

---

## 12. Storico delle sessioni

| Data | Modello | Cosa è stato fatto |
|---|---|---|
| 2026-08-05 | Claude Opus 4.5 | Progetto creato da zero con AI-OS. Fase 1: fondamenta React+Vite+TS+Tailwind, Supabase con RLS, autenticazione, profilo e impostazioni persistenti, navigazione, pubblicazione su Vercel |
