# Project Overview

GymBuilder costruisce sessioni coerenti usando catalogo esercizi, configurazione corrente e dati fisici dell'utente. Le regole forti (sicurezza, attrezzatura e divieti) precedono preferenze e varietà.

Stack: TypeScript, React 18, React Router, Vite, Tailwind CSS, Vitest, Supabase Auth/Postgres/RLS.

Funzionalità: cinque modalità pubbliche combinabili; Weekly Program Engine su 3-7 giorni; settimana modificabile; split Bodybuilding dinamici; weak point e preferenze globali; inventario granulare; CrossFit AMRAP/EMOM/For Time; Hybrid Strength + Metcon; Forza; Tabata configurabile; sostituzione singolo esercizio; salvataggi; storico tecnico; runner; calorie stimate.

I dati stabili sono in `UserProfile`; le scelte della sessione sono in `WorkoutGenerationConfig`. Il contesto workout conserva workout e configurazione in `sessionStorage`, mentre gli allenamenti salvati/completati vivono in Supabase.
