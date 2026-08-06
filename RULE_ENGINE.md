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

Le sessioni candidate hanno un `RecoveryProfile`: fatica, stress per muscolo, cardio, grip, stress sistemico, durata e recupero richiesto. Il motore valuta tutte le permutazioni possibili e sceglie il punteggio migliore per recupero, sovrapposizione e weak point. Dopo la generazione, il profilo previsto viene sostituito dai dati reali degli esercizi scelti.

## Feedback e sostituzioni

Il replacement ranking rispetta pattern, muscolo, ruolo, attrezzatura, livello, fatica, preferiti e feedback storico. I sei motivi hanno pesi distinti. I rifiuti temporanei vivono nella sessione; esclusioni esplicite, disagio e attrezzi assenti alimentano la memoria adattiva locale per utente.

Combinazioni testate: BB+Hybrid; BB+CrossFit Standard; BB+Forza+Hybrid; BB+Hybrid+Tabata; Forza+Hybrid; BB+Tabata; CrossFit Standard+Hybrid; BB+CrossFit Standard+Hybrid+Tabata.
