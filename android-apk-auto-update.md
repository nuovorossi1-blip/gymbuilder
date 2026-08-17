# GymBuilder — APK Android e aggiornamenti

## Stato implementazione

- Capacitor Android usa `https://gymbuilder-lemon.vercel.app`: gli aggiornamenti solo web arrivano già senza reinstallare l'APK.
- `public/version.json` descrive l'ultima release nativa.
- `NativeUpdater` confronta la versione installata con quella remota all'avvio.
- Il plugin nativo `ApkUpdater` scarica l'APK via DownloadManager e apre l'installatore Android.
- `InstallBanner` propone il download su browser Android e le istruzioni PWA su iOS.
- Il workflow `.github/workflows/android-release.yml` crea una Release firmata quando viene pubblicato un tag `android-v*`.

Android richiede sempre una conferma dell'utente per installare l'aggiornamento. Al primo utilizzo occorre autorizzare GymBuilder in **Installa app sconosciute**. L'APK nuovo deve essere firmato con la stessa keystore di quello già installato.

## Segreti GitHub richiesti

Configurare in GitHub → Settings → Secrets and variables → Actions:

- `ANDROID_KEYSTORE_BASE64`: contenuto base64 della keystore `.jks`;
- `ANDROID_STORE_PASSWORD`;
- `ANDROID_KEY_ALIAS`;
- `ANDROID_KEY_PASSWORD`.

La keystore non deve mai essere inserita nel repository. Va conservata anche in un backup sicuro: perderla impedisce di aggiornare le installazioni esistenti.

## Pubblicare una versione

1. Aumentare `versionCode` e `versionName` in `android/app/build.gradle`.
2. Aggiornare `public/version.json` con gli stessi valori, note e:
   `https://github.com/nuovorossi1-blip/gymbuilder/releases/latest/download/GymBuilder.apk`.
3. Verificare `npm test`, `npm run build` e `npm run cap:sync`.
4. Unire le modifiche in `main`.
5. Creare e pubblicare il tag, per esempio `android-v1.1.0`.
6. Attendere il workflow Android Release e verificare la Release GitHub.
7. Installare la prima versione e simulare una versione successiva per verificare la sovrascrittura.

## iOS

Su iPhone non è possibile distribuire o aggiornare APK. Il banner mostra il percorso Safari **Condividi → Aggiungi alla schermata Home**; Service Worker e manifest continuano a gestire la PWA.
