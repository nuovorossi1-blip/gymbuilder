# GymBuilder — istruzioni permanenti

Questo progetto segue il protocollo **AI-OS** (https://github.com/nuovorossi1-blip/ai-os).
Riferimento identità/protocollo: `AIOS_PROJECT.json`. Stato del progetto: `AIOS_STATE.md`.

## Regola non negoziabile: aggiornamento della memoria

**Ogni volta che finisci un pezzo di lavoro — anche piccolo, anche una sola
correzione — prima di dichiararlo concluso devi:**

1. Aggiornare `AIOS_STATE.md` con: cosa hai fatto e perché, cosa si è rotto
   durante il lavoro e come l'hai aggiustato, quali problemi restano aperti,
   qual è il prossimo passo sensato, il tuo nome di modello e la data.
2. Aggiornare `TODO.md` se il lavoro chiude o apre voci della lista.
3. Fare commit della memoria insieme al codice (un solo commit, non due),
   a meno che l'utente non abbia chiesto esplicitamente di non committare.

Non è opzionale e non va chiesto all'utente: questi file sono la memoria che
permette alla prossima sessione — anche con un LLM diverso — di riprendere
il progetto senza rispiegare tutto da capo. Se salti questo passo, il lavoro
fatto in questa sessione è invisibile alla prossima.

Non riscrivere `AIOS_STATE.md` da zero: si aggiunge e si corregge ciò che è
cambiato, si lascia intatto lo storico. La sezione dei problemi risolti non
si cancella mai.

Per riprendere il contesto completo del progetto in una sessione nuova, il
comando è `/handoff gymbuilder` (vedi `AIOS_PROJECT.json` per i dettagli del
protocollo).
