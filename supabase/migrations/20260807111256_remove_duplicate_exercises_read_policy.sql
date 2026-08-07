-- La policy storica consentiva tutti i record ed era sovrapposta alla policy
-- più recente, che limita la lettura agli esercizi attivi.
drop policy if exists "esercizi: lettura per utenti autenticati" on public.exercises;
