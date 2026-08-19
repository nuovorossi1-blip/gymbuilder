-- Aggiunge focus_portion: quale capo/porzione lavora di più un esercizio,
-- solo dove il muscolo ha una vera sotto-struttura biomeccanica (oggi
-- bicipiti e tricipiti). Nullable e non NOT NULL: non tutti gli esercizi del
-- catalogo hanno una porzione (squat, rematore, panca restano senza tag).
-- Usato dallo Smart Exercise Swap (stesso angolo di lavoro) e dalla
-- rotazione settimanale delle carenze bicipiti/tricipiti.

alter table public.exercises
  add column if not exists focus_portion text;

-- Bicipiti: curl_bilanciere/curl_manubri restano generici (il movimento
-- "base", non un'alternativa di porzione specifica).
update public.exercises set focus_portion = 'long_head' where id in ('curl_inclinata_man', 'bayesian_curl', 'trazioni_supine');
update public.exercises set focus_portion = 'short_head' where id in ('curl_panca_scott', 'preacher_curl_macchina', 'curl_cavo');
update public.exercises set focus_portion = 'brachialis' where id in ('curl_martello');

-- Tricipiti.
update public.exercises set focus_portion = 'long_head' where id in ('french_press', 'estensioni_sopra_testa', 'estensione_tricipiti_cavo_alto');
update public.exercises set focus_portion = 'lateral_head' where id in ('pushdown', 'pushdown_unilaterale');
update public.exercises set focus_portion = 'medial_head' where id in ('dip_panca', 'dip_parallele', 'piegamenti_diamante');
