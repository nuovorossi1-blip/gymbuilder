# GymBuilder

App mobile-first per generare, salvare ed eseguire allenamenti personalizzati.
Il flusso principale è **Genera → configura la settimana → modifica i giorni → genera una sessione → Salva o Inizia**.

Le modalità pubbliche sono Bodybuilding, CrossFit Standard, CrossFit Hybrid,
Forza e Tabata. Vedi `AI_CONTEXT.md` per un orientamento rapido e
`RULE_ENGINE.md` per le regole implementate.

Combina una o più discipline su 3-7 giorni. Il Weekly Program Engine costruisce
la settimana considerando obiettivo, recupero e sovrapposizione; i generatori
specifici costruiscono poi esercizi, ordine, serie, ripetizioni, recuperi e timer.

---

## A che punto è

Sono implementati autenticazione, profilo fisico, Weekly Program Engine, cinque
generatori, anteprima, sostituzione esercizi, salvataggi, runner e stima calorie.
La suite automatica contiene 156 test. Il piano completo sta in
[`ROADMAP.md`](./ROADMAP.md).

---

## Per l'AI che legge questo repository

Questo progetto è gestito con **AI-OS**. Prima di modificare qualsiasi cosa, leggi
[`AIOS_PROJECT.json`](./AIOS_PROJECT.json) e [`AIOS_STATE.md`](./AIOS_STATE.md),
e segui il protocollo indicato in `aios_reference`.

Il comando per riprendere il lavoro è `/handoff gymbuilder`: ricostruisci lo stato,
presentalo, e **fermati** finché l'utente non ti dice cosa continuare.

---

## Tecnologia

React 18 · Vite 5 · TypeScript · Tailwind CSS · Supabase (PostgreSQL, Auth, RLS) ·
pubblicato su Vercel.

## Sviluppo in locale

```bash
npm install
cp .env.example .env   # e riempi i due valori
npm run dev
```

Le due variabili si trovano nel pannello Supabase, sezione *Project Settings → API*:

| Variabile | Cos'è |
|---|---|
| `VITE_SUPABASE_URL` | l'indirizzo del progetto |
| `VITE_SUPABASE_ANON_KEY` | la chiave pubblica |

La chiave pubblica non è un segreto: è progettata per stare nel codice del browser.
A proteggere i dati sono le regole RLS del database.

## Licenza

MIT
