# Roadmap

## COMPLETATO

- Cinque modalità pubbliche e navigazione Genera/Salvati/Profilo.
- Configurazione sessione separata dal Profilo.
- Split Bodybuilding 2-7 giorni, scelta del giorno, livello, durata e weak point.
- Equipment hard-block, policy corpo libero/elastici, sostituzione esercizio.
- CrossFit Standard, Hybrid, Forza e Tabata configurabile.
- Anteprima prima dell'avvio, salvataggi e runner.
- Profilo fisico e calorie stimate con fallback MET/algoritmo HR.
- Weekly Program Engine multi-modalità, settimana modificabile e ritorno persistente.
- Configurazione globale condivisa fra tutte le discipline.
- 131 test, incluse le combinazioni A–I; build e lint senza errori.
- Recovery profile reale e scheduling multi-candidato fatigue-aware.
- Exercise Feedback Engine con sei motivazioni e replacement semantico.
- 137 test totali, inclusi regressione/progressione/disagio/attrezzatura.
- Vincoli movement-pattern per Push/Pull/Legs e replacement contestuale.
- Profile contract `user_id`, RLS e persistenza fisica in migration idempotente.
- Timer Engine a timestamp con eventi e audio Beep/Ding/Silenzioso.
- 158 test, build Vite e asset CSS verificati.
- Carenze spalle/braccia distribuite dal Weekly Engine secondo PPL, Upper/Lower, Front/Back o Bro Split; lavoro principale e richiami non superano sei esercizi per seduta.
- Ordine Bodybuilding fatigue-aware: Legs parte da squat/pressa, alterna catena anteriore/posteriore e chiude con isolamenti/polpacci; Push separa i press pesanti con il lavoro spalle.
- Countdown percepibile con tre bip e vibrazione opzionale; Belt Squat aggiunto al catalogo remoto.

## IN SVILUPPO

- Verifica end-to-end autenticata su deployment.
- Verifica audio su dispositivi iPhone/Android reali.

## PROSSIMO

- Adapter HealthKit e Health Connect in packaging mobile.
- Packaging iOS con ActivityKit/WidgetKit: Live Activity sulla schermata di blocco e timer nella Dynamic Island.
- Foreground service/notifica persistente Android per il timer quando l'app è in background.
- Rigenerazione automatica multi-tentativo quando una configurazione non supera il validatore.

## FUTURO

- Integrazioni wearable aggiuntive, notifiche e progressioni longitudinali.
