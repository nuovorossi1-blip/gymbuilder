# GymBuilder

Genera allenamenti su misura. Dici che esperienza hai, che attrezzatura trovi in
palestra e quanto tempo hai oggi; l'app costruisce la sessione — esercizi, ordine,
serie, ripetizioni, recuperi e timer.

Sei modalità previste: Bodybuilding, Forza, CrossFit Standard, CrossFit Hybrid,
Condizionamento, Tabata.

---

## A che punto è

**Fase 1 di 15.** Funzionano registrazione, accesso e il profilo di allenamento
completo: quello che imposti qui deciderà come verranno costruiti gli allenamenti.

I motori di generazione arrivano dalla fase 3 in poi. Il piano completo sta in
[`AIOS_STATE.md`](./AIOS_STATE.md).

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
