# Todo

- [x] Separare davvero `Intermedio` da `Principiante` nelle etichette e nel wizard di generazione.
- [x] Correggere la sessione singola Bodybuilding a gruppi personalizzati: niente piu compound petto se il petto non e selezionato.
- [x] Limitare la seduta custom a massimo 6 esercizi, pesando di piu i gruppi muscolari carenti inclusi nella selezione.
- [x] Rendere il pool Metcon piu robusto accettando anche movimenti `metcon_safe` se il catalogo non e taggato perfettamente.
- [x] Aggiungere nel Profilo una configurazione locale DeepSeek (chiave API + modello) senza dipendere subito da nuove tabelle Supabase.
- [x] Esporre in `Genera` un percorso `Genera con DeepSeek` che suggerisca una configurazione prima della generazione del motore interno.
- [ ] Valutare una Edge Function / proxy server per DeepSeek, cosi la chiave API non viaggia direttamente dal browser nelle richieste web.

- [x] Introdurre un `ActiveSessionStore` persistente separato dal solo `Runner`, con `sessionId`, workout attivo, step corrente, deadline reali, stato pausa e ownership della sessione.
- [x] Fare di `/avvia` una vera route di resume: se esiste una sessione attiva la riprende, se esiste solo il workout chiede se ripartire da capo, se non esiste nulla mostra stato vuoto.
- [x] Impedire che banner, notifica, pulsante "Continua" o ritorno dal background creino una nuova sessione: ogni entrypoint deve riaprire la sessione attiva già esistente.
- [x] Correggere `public/sw.js` per rifocalizzare la finestra giusta e inviare un messaggio `RESUME_ACTIVE_SESSION`, invece di navigare alla cieca il primo client disponibile.
- [x] Gestire esplicitamente multi-tab/multi-instance con `BroadcastChannel` o evento `storage`, mantenendo una sola sessione attiva proprietaria.
- [ ] Verificare su telefono reale il flusso completo: avvio Tabata, cambio app, lock screen, ritorno da banner/notifica e ripresa su `/avvia` senza reset della sessione.
- [x] Integrare Capacitor Android come contenitore nativo dell'app web, mantenendo il frontend servito dal dominio di produzione.
- [x] Configurare l'app Android perché carichi la build live aggiornata a ogni deploy, evitando la reinstallazione manuale dell'APK per ogni release frontend.
- [ ] Installare Android SDK locale e produrre una prima `debug APK` da `android/`; oggi il repository è pronto ma la build si ferma per `ANDROID_HOME`/`sdk.dir` mancanti.
- [ ] Valutare se serve un vero foreground service Android con notifica persistente nativa per timer/background, invece del solo comportamento PWA/web.
- [ ] Applicare `supabase/migrations/20260806170000_profiles_contract_and_rls.sql` al Supabase di produzione e verificare logout/login.
- [ ] Applicare `supabase/migrations/20260806123000_saved_workout_generation_config.sql` al remoto.
- [ ] Verificare con account reale registrazione, modifica profilo, generazione, cambio esercizio, salvataggio e completamento.
- [ ] Aggiungere adapter nativi per `HealthDataProvider`; non promettere compatibilità universale.
- [ ] Persistenza server-side dell'intero `WeeklyProgram` per sincronizzare la settimana fra dispositivi; oggi è sessionStorage.
- [ ] Sincronizzare la memoria adattiva degli esercizi su Supabase; oggi è localStorage per utente/browser.
- [x] Risolvere i tre warning lint legacy Fast Refresh separando provider/helper esportati ed esplicitando allowExportNames per custom hook in eslint.config.js.
- [ ] Valutare i quattro advisory npm senza usare aggiornamenti forzati incompatibili.
- [ ] Provare audio/countdown su Safari iOS e Chrome Android reali, incluse lock screen e modalità risparmio energetico.
