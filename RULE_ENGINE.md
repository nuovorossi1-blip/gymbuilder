# Rule Engine

Ordine applicato: sicurezza/validità → attrezzatura non disponibile → esclusioni e policy → struttura della modalità → fatica/recupero → weak point → preferiti → varietà → seme pseudocasuale.

## Componenti reali

- `equipment.ts`: hard-block sui requisiti granulari.
- `preferences.ts`: `always`, `finisher_only`, `never` per corpo libero ed elastici.
- `weeklyPlan.ts`: traduce famiglia split + 2-7 giorni in una settimana selezionabile.
- `weakPoints.ts`: volume mobile, recupero minimo e richiami.
- generatori Bodybuilding/Forza: slot prima degli esercizi, ordinamento e adattamento durata.
- generatori CrossFit/Hybrid/Tabata: strutture specifiche e pool Metcon sicuro.
- `replacement.ts`: sostituto con stesso tipo/muscolo e fatica vicina, rispettando hard-block.
- `validator.ts`: modalità, giorno, catalogo, duplicati, attrezzatura, esclusioni e durata massima.
- `timer.ts`: macchina a stati pura per lavoro/riposo/round; il Runner gestisce anche AMRAP, EMOM e For Time.

Un workout non viene mostrato se `validateWorkout` fallisce. Il messaggio rimanda alla configurazione invece di proporre attrezzi vietati.

## Weekly Program Engine

Riceve 3-7 giorni, una o più delle cinque modalità, obiettivo, livello, tempo e regole globali. Garantisce una presenza minima per ogni modalità e assegna i giorni restanti usando pesi diversi per obiettivo, non una divisione aritmetica. Tabata resta una sessione complementare quando è combinato.

Le sessioni candidate hanno carico muscolare e fatica stimata. Un ordinamento greedy penalizza sovrapposizione, due giornate ad alta fatica e ripetizione della stessa disciplina. Il validatore segnala giornate duplicate, fatica alta consecutiva, sovrapposizione e attrezzatura metabolica insufficiente senza impedire modifiche manuali.

Combinazioni testate: BB+Hybrid; BB+CrossFit Standard; BB+Forza+Hybrid; BB+Hybrid+Tabata; Forza+Hybrid; BB+Tabata; CrossFit Standard+Hybrid; BB+CrossFit Standard+Hybrid+Tabata.
