# AI Context — GymBuilder

GymBuilder è una web app React 18/Vite mobile-first che genera, salva ed esegue allenamenti deterministici. Backend, autenticazione e persistenza sono Supabase. Il motore non usa un LLM.

## Flusso prodotto

`Genera → giorni e discipline → configurazione globale → settimana modificabile → singolo giorno → anteprima → Salva oppure Inizia`.
La navigazione pubblica contiene solo Genera, Salvati e Profilo. Le modalità pubbliche sono Bodybuilding, CrossFit Standard, CrossFit Hybrid, Forza e Tabata. Conditioning resta un motore interno/legacy, non è selezionabile dalla home.

## Dove guardare

- `src/types/index.ts`: modelli e label.
- `src/pages/Create.tsx`: configurazione effimera della generazione.
- `src/generators/`: motori deterministici esistenti.
- `src/engine/weeklyPlan.ts`: Weekly Program Engine fitness-aware.
- `src/engine/`: policy, sostituzioni, validazione workout e timer.
- `src/engine/feedback.ts`: memoria adattiva dei motivi di sostituzione.
- `src/pages/WorkoutPreview.tsx`: scheda, salvataggio e cambio esercizio.
- `src/pages/Runner.tsx`: runner pesi e Metcon/Tabata.
- `src/lib/api.ts`: accesso Supabase.
- `supabase/migrations/`: schema versionato.

## Stato verificato

Al 2026-08-06: 149 test verdi, build verde, lint senza errori bloccanti. Il giorno Bodybuilding è un vincolo strutturale anche a livello di movement pattern; carenze e replacement non possono trasformare Push/Pull/Legs. Il Runner usa timestamp reali, eventi tipizzati e Web Audio (Beep/Ding/Silenzioso) sbloccato dall'interazione utente. Il contratto Profile usa `profiles.user_id`; la migration RLS `20260806170000_profiles_contract_and_rls.sql` deve essere applicata al Supabase di produzione, non accessibile dal connettore corrente.

## Prossimo passo

Applicare le migration remote, verificare con un account autenticato Profile logout/login e Genera → Salva → Inizia, poi provare l'audio su iOS/Android reali (le policy browser variano).
