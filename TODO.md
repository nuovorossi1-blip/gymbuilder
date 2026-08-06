# Todo

- [ ] Applicare `supabase/migrations/20260806170000_profiles_contract_and_rls.sql` al Supabase di produzione e verificare logout/login.
- [ ] Applicare `supabase/migrations/20260806123000_saved_workout_generation_config.sql` al remoto.
- [ ] Verificare con account reale registrazione, modifica profilo, generazione, cambio esercizio, salvataggio e completamento.
- [ ] Aggiungere adapter nativi per `HealthDataProvider`; non promettere compatibilità universale.
- [ ] Persistenza server-side dell'intero `WeeklyProgram` per sincronizzare la settimana fra dispositivi; oggi è sessionStorage.
- [ ] Sincronizzare la memoria adattiva degli esercizi su Supabase; oggi è localStorage per utente/browser.
- [ ] Risolvere i tre warning lint legacy Fast Refresh separando provider/helper esportati.
- [ ] Valutare i quattro advisory npm senza usare aggiornamenti forzati incompatibili.
- [ ] Provare audio/countdown su Safari iOS e Chrome Android reali, incluse lock screen e modalità risparmio energetico.
