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

## Regola non negoziabile: l'app si aggiorna da sola a ogni modifica

**Il solo commit locale non basta. Dopo aver committato codice o modifiche
Android, devi anche fare `git push origin main`, senza chiederlo
all'utente**, a meno che l'utente non abbia esplicitamente chiesto di NON
pushare in questa sessione.

Perché è vincolante: il workflow `.github/workflows/build-apk.yml` si attiva
a ogni push su `main` (tranne quando tocca solo `public/gymbuilder.apk`,
`public/version.json` o `android/app/debug.keystore`, per evitare loop). Da
solo, senza bisogno di tag o di credenziali release:

1. incrementa `versionCode`/`versionName` in `android/app/build.gradle`
   usando il numero di run della CI;
2. builda un APK debug (firmato con `android/app/debug.keystore`, già nel
   repo);
3. lo copia in `public/gymbuilder.apk` e aggiorna `public/version.json`;
4. fa commit di questi due file su `main` (`chore: update Android APK
   [skip ci]`) e pubblica su Vercel.

`NativeUpdater`, dentro l'app, confronta `public/version.json` con la
versione installata a ogni avvio e propone l'aggiornamento (Android chiede
comunque conferma per installare, non è mai silenzioso — vedi
`android-apk-auto-update.md`). Questo copre sia le modifiche solo web sia
quelle native (Java/XML/plugin Capacitor): **non serve mai creare un tag
`android-v*` per il normale ciclo di lavoro** — quello (`android-release.yml`)
serve solo per una release firmata "ufficiale" con la keystore di produzione,
un passo separato ed esplicito, non implicito in ogni modifica.

Se `git push` fallisce (branch protetta, conflitto, credenziali mancanti),
dillo subito all'utente invece di lasciare il lavoro solo committato in
locale: un commit non pushato non aggiorna l'app.
