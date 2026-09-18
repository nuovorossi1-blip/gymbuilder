# GymBuilder — APK Android e aggiornamenti

## Stato implementazione

- Capacitor Android usa `https://gymbuilder-lemon.vercel.app`: gli aggiornamenti solo web arrivano già senza reinstallare l'APK.
- L'APK **non e' piu' committato in `public/`** (dal 18/09/2026): esce come GitHub
  Release con tag `apk-v1.0.<run_number>`, insieme a `version.json`. Link fisso:
  `https://github.com/nuovorossi1-blip/gymbuilder/releases/latest/download/GymBuilder.apk`.
  Prima ogni build aggiungeva ~4 MB alla storia del repo e i due file potevano
  restare sfasati (commit dell'APK e deploy Vercel non sono atomici).
- `NativeUpdater` confronta la versione installata con quella remota all'avvio.
- Il plugin nativo `ApkUpdater` scarica l'APK via DownloadManager e apre l'installatore Android.
- `InstallBanner` propone il download su browser Android e le istruzioni PWA su iOS.
- `.github/workflows/build-apk.yml` compila l'APK **debug** e pubblica la Release.
  Da 18/09/2026 parte solo quando cambia il guscio (`android/**`,
  `capacitor.config.ts`, `package.json`, `package-lock.json`, il workflow stesso)
  oppure a mano da Actions. Prima girava a ogni push e faceva comparire
  "Aggiorna app" sul telefono anche per modifiche solo web, con un APK identico.
- `.github/workflows/android-release.yml` crea una Release **firmata** quando viene
  pubblicato un tag `android-v*`.

> ⚠️ **Debug e release NON sono intercambiabili sullo stesso telefono.** Hanno
> firme diverse (`android/app/debug.keystore` contro la keystore di release), e
> Android rifiuta l'aggiornamento fra APK con firma diversa: bisogna disinstallare
> e reinstallare, perdendo i dati locali. In piu' le versioni devono restare
> ordinate: il workflow debug usa `versionCode = <run_number>` e
> `versionName = 1.0.<run_number>`, quello di release parte da
> `versionCode = 1000 + <run_number>` e `versionName = 1.1.<run_number>` proprio
> per stare sopra a qualsiasi debug. Prima compilava con i valori fermi del file
> (1 / 1.0.0), quindi una release sarebbe risultata piu' vecchia di ogni debug.

Android richiede sempre una conferma dell'utente per installare l'aggiornamento. Al primo utilizzo occorre autorizzare GymBuilder in **Installa app sconosciute**. L'APK nuovo deve essere firmato con la stessa keystore di quello già installato.

## Segreti GitHub richiesti

Configurare in GitHub → Settings → Secrets and variables → Actions:

- `ANDROID_KEYSTORE_BASE64`: contenuto base64 della keystore `.jks`;
- `ANDROID_STORE_PASSWORD`;
- `ANDROID_KEY_ALIAS`;
- `ANDROID_KEY_PASSWORD`.

La keystore non deve mai essere inserita nel repository. Va conservata anche in un backup sicuro: perderla impedisce di aggiornare le installazioni esistenti.

Le pipeline usano Node 24/npm 11 e Java 21, allineati alla toolchain con cui vengono verificati lockfile, Capacitor e Gradle.

## Pubblicare una versione

**APK debug (il caso normale).** Non c'e' niente da fare a mano: versione,
`version.json` e Release li scrive il workflow. Basta che il commit tocchi il
guscio, oppure lanciare "Build APK for Vercel" da Actions → Run workflow.

**APK firmato (solo se serve una distribuzione ufficiale).**
1. Verificare `npm test`, `npm run build` e `npm run cap:sync`.
2. Unire le modifiche in `main`.
3. Creare e pubblicare il tag, per esempio `android-v1.1.0`.
4. Attendere il workflow Android Release e verificare la Release GitHub.
5. Ricordare che chi ha installato un APK debug deve disinstallarlo prima: firme
   diverse, l'aggiornamento sopra non e' possibile.

## iOS

Su iPhone non è possibile distribuire o aggiornare APK. Il banner mostra il percorso Safari **Condividi → Aggiungi alla schermata Home**; Service Worker e manifest continuano a gestire la PWA.
