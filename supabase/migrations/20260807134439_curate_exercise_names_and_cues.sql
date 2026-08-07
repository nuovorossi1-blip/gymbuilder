-- Nomi italiani quando naturali; termini tecnici d'uso comune restano in inglese.
-- Ogni cue descrive posizione e azione in due frasi brevi.
with cues(id, italian_name, cue) as (values
  ('calf_leg_press','Calf raise alla pressa','Tieni le punte dei piedi sulla pedana e le ginocchia quasi distese. Spingi la pedana con gli avampiedi, solleva i talloni e scendi lentamente.'),
  ('croci_manubri','Croci con manubri','Sdraiati sulla panca con i manubri sopra il petto e i gomiti leggermente piegati. Apri le braccia in controllo, poi richiudile avvicinando i manubri sopra il petto.'),
  ('pec_deck','Pec deck','Siediti con schiena e testa appoggiate, gomiti allineati alle impugnature. Chiudi le braccia davanti al petto e ritorna lentamente senza perdere tensione.'),
  ('ab_wheel','Ab wheel rollout','Parti in ginocchio con mani sulla ruota e addome contratto. Fai scorrere la ruota avanti mantenendo il bacino stabile, poi torna usando il core.'),
  ('pallof_press','Pallof press','Mettiti di lato al cavo e porta la maniglia davanti al petto. Distendi le braccia senza lasciare ruotare il busto, poi rientra lentamente.'),
  ('estensione_tricipiti_cavo_alto','Estensione tricipiti sopra la testa al cavo','Dai le spalle al cavo e tieni i gomiti vicini alla testa. Distendi gli avambracci in avanti senza muovere le spalle, poi ritorna in controllo.'),
  ('pushdown_unilaterale','Pushdown a un braccio','Tieni il gomito fermo accanto al fianco e afferra il cavo con una mano. Distendi completamente il braccio verso il basso, poi risali senza sollevare il gomito.'),
  ('bayesian_curl','Bayesian curl al cavo','Posizionati davanti al cavo basso con il braccio leggermente dietro il busto. Fletti il gomito portando la mano verso la spalla, senza avanzare il gomito.'),
  ('curl_inclinata_man','Curl con manubri su panca inclinata','Appoggia la schiena alla panca inclinata e lascia le braccia distese ai lati. Fletti i gomiti senza portarli avanti, poi abbassa i manubri lentamente.'),
  ('preacher_curl_macchina','Curl alla panca Scott guidata','Appoggia completamente le braccia al cuscino della macchina. Fletti i gomiti portando le impugnature verso di te, poi distendi senza staccare i gomiti.'),
  ('good_morning_bil','Good morning con bilanciere','Tieni il bilanciere sulla parte alta della schiena e le ginocchia morbide. Spingi il bacino indietro inclinando il busto neutro, poi estendi le anche per risalire.'),
  ('hip_thrust_macchina','Hip thrust alla macchina','Sistema il bacino sotto l’imbottitura e appoggia bene i piedi. Spingi attraverso i talloni fino a estendere le anche, poi scendi senza inarcare la schiena.'),
  ('single_leg_rdl','Stacco rumeno a una gamba','Stai su una gamba con il manubrio nella mano opposta e il bacino rivolto a terra. Porta il bacino indietro mentre la gamba libera sale, poi torna contraendo gluteo e femorale.'),
  ('glute_kickback_cavo','Slancio posteriore al cavo','Fissa la cavigliera e inclina leggermente il busto mantenendo il bacino fermo. Spingi la gamba indietro contraendo il gluteo, poi ritorna senza slancio.'),
  ('high_row_macchina','Rematore alto alla macchina','Siediti con il petto stabile e afferra le impugnature alte. Tira i gomiti indietro e verso il basso, poi distendi le braccia senza perdere l’assetto.'),
  ('rematore_macchina','Rematore alla macchina','Siediti con busto stabile e afferra le impugnature a braccia distese. Porta i gomiti indietro avvicinando le scapole, poi ritorna lentamente.'),
  ('rematore_chest_supported_man','Rematore con manubri su panca a 45°','Appoggia il petto alla panca inclinata a 45° e lascia i manubri sotto le spalle. Porta entrambi i manubri verso il petto stringendo le scapole, poi abbassali in controllo.'),
  ('t_bar_row','T-Bar Row','Mantieni il busto inclinato e la schiena neutra afferrando la maniglia. Tira il carico verso la parte bassa del petto, poi distendi le braccia senza arrotondare la schiena.'),
  ('chest_press_convergente','Chest press convergente','Siediti con schiena appoggiata e impugnature all’altezza del petto. Spingi avanti facendo convergere le mani, poi ritorna lentamente con i gomiti controllati.'),
  ('chest_press_inclinata','Chest press inclinata','Regola il sedile per spingere in diagonale dalla parte alta del petto. Distendi le braccia senza sollevare le spalle, poi torna in controllo.'),
  ('panca_piana_man','Panca piana con manubri','Sdraiati con piedi stabili e manubri ai lati del petto. Spingi i manubri verso l’alto e leggermente insieme, poi scendi mantenendo le scapole ferme.'),
  ('leg_curl_seduto','Leg curl da seduto','Siediti con ginocchia allineate al perno e cuscinetto sopra le caviglie. Fletti le ginocchia portando i talloni sotto il sedile, poi ritorna lentamente.'),
  ('alzate_laterali_macchina','Alzate laterali alla macchina','Siediti con i gomiti appoggiati ai cuscinetti e le spalle basse. Solleva le braccia fino alla linea delle spalle, poi scendi senza lasciare cadere il carico.'),
  ('reverse_lunge_man','Affondo inverso con manubri','Tieni i manubri ai lati e fai un passo indietro mantenendo il busto stabile. Scendi con entrambe le ginocchia, poi spingi sul piede davanti per tornare.'),
  ('rear_delt_cavi','Croci inverse ai cavi','Afferra i cavi incrociati con le braccia davanti al petto e gomiti morbidi. Apri le braccia portando le mani ai lati, poi ritorna senza muovere il busto.'),
  ('pendulum_squat','Pendulum squat','Posiziona schiena e spalle sui supporti con i piedi stabili sulla pedana. Scendi piegando le ginocchia in profondità controllata, poi spingi la pedana per risalire.'),
  ('lat_machine_neutra','Lat machine a presa neutra','Siediti con le cosce bloccate e afferra le maniglie con i palmi rivolti. Porta i gomiti verso i fianchi e la barra al petto, poi risali senza slancio.'),
  ('pulldown_unilaterale','Lat pulldown a un braccio','Siediti stabile e afferra il cavo alto con un braccio disteso. Porta il gomito verso il fianco senza inclinare il busto, poi distendi lentamente.'),
  ('landmine_press','Landmine press','Tieni l’estremità del bilanciere davanti alla spalla con busto e addome stabili. Spingi il bilanciere avanti e in alto, poi riportalo alla spalla in controllo.')
)
update public.exercises e
set name = cues.italian_name,
    instructions = cues.cue,
    description = cues.cue
from cues
where e.id = cues.id;

-- La variante unilaterale non aggiunge un pattern o una traiettoria distinti
-- rispetto alla Leg Extension classica: resta un solo esercizio nel catalogo.
update public.exercises
set active = false,
    substitutions = array['leg_extension']::text[]
where id = 'leg_extension_unilaterale';

update public.exercises
set substitutions = array_replace(substitutions, 'leg_extension_unilaterale', 'leg_extension')
where substitutions @> array['leg_extension_unilaterale']::text[];

with crossfit_cues(id, italian_name, cue) as (values
  ('running','Corsa','Corri con busto alto, passi regolari e appoggio sotto il corpo. Mantieni un ritmo adatto alla distanza senza irrigidire spalle e braccia.'),
  ('jump_rope','Salto con la corda','Fai girare la corda con i polsi tenendo i gomiti vicini al corpo. Salta basso sugli avampiedi con ritmo regolare e ginocchia morbide.'),
  ('jumping_jack','Jumping jack','Parti con piedi uniti e braccia ai lati. Salta divaricando le gambe e portando le mani sopra la testa, poi torna alla posizione iniziale.'),
  ('farmers_walk','Camminata con pesi','Tieni due pesi ai lati con presa forte, busto alto e addome contratto. Cammina a passi brevi senza oscillare o lasciare cadere le spalle.'),
  ('wall_ball','Wall ball','Tieni la palla al petto e scendi in squat con i talloni a terra. Risali con forza e lancia la palla al bersaglio, ricevendola già pronto per la ripetizione successiva.'),
  ('turkish_get_up','Turkish get-up','Parti sdraiato con il kettlebell sopra una spalla e lo sguardo sul peso. Alzati passando da gomito, mano, ponte e affondo, poi torna a terra invertendo i passaggi.'),
  ('pullup_assisted','Trazioni assistite','Usa elastico o macchina per alleggerire il peso mantenendo il corpo stabile. Porta il petto verso la sbarra guidando con i gomiti, poi distendi le braccia in controllo.'),
  ('jumping_pullup','Trazioni con salto','Parti su un rialzo con la sbarra raggiungibile e usa un piccolo salto per iniziare. Completa la tirata portando il mento sopra la sbarra, poi scendi controllando le braccia.'),
  ('dip_assisted','Dip assistiti','Appoggia mani alle parallele e usa elastico o macchina per ridurre il carico. Scendi piegando i gomiti, poi spingi fino a distendere le braccia senza sollevare le spalle.'),
  ('hollow_hold','Hollow hold','Sdraiati premendo la zona lombare contro il pavimento. Solleva spalle e gambe mantenendo addome contratto e corpo curvo senza perdere il contatto lombare.'),
  ('double_under','Double under','Salta poco più in alto del salto singolo mantenendo il corpo verticale. Accelera i polsi per far passare la corda due volte sotto i piedi a ogni salto.'),
  ('assault_bike','Assault Bike','Spingi e tira le maniglie mentre pedali mantenendo il busto stabile. Distribuisci lo sforzo fra braccia e gambe e scegli un ritmo sostenibile per il lavoro previsto.'),
  ('ski_erg','SkiErg','Parti alto con braccia distese e maniglie sopra la testa. Fletti anche e ginocchia tirando le maniglie verso le cosce, poi ritorna fluido alla posizione alta.'),
  ('burpee_over_bar','Burpee oltre il bilanciere','Esegui il burpee parallelo al bilanciere portando petto e cosce a terra. Rialzati e salta lateralmente oltre la barra atterrando con entrambi i piedi.'),
  ('box_jump_over','Salto oltre il box','Salta sul box con entrambi i piedi e ginocchia allineate. Attraversa o ruota sopra il box e scendi dall’altro lato in controllo prima della ripetizione.'),
  ('power_clean','Power clean','Stacca il bilanciere da terra mantenendolo vicino al corpo e accelera estendendo anche e ginocchia. Ricevilo sulle spalle in un quarto di squat con gomiti rapidi in avanti.'),
  ('clean_jerk','Clean & Jerk','Porta il bilanciere da terra alle spalle con un clean controllato. Dopo esserti stabilizzato, usa gambe e braccia per spingerlo sopra la testa e bloccarlo in equilibrio.'),
  ('power_snatch','Power snatch','Solleva il bilanciere vicino al corpo estendendo con forza anche e ginocchia. Ricevilo direttamente sopra la testa in squat parziale con braccia bloccate.'),
  ('overhead_squat','Squat con bilanciere sopra la testa','Tieni il bilanciere sopra la testa con presa larga, gomiti bloccati e spalle attive. Scendi in squat mantenendo il peso sopra il centro del piede, poi risali stabile.'),
  ('push_jerk','Push jerk','Tieni il bilanciere sulle spalle, piega rapidamente le ginocchia e spingi con le gambe. Scendi sotto il bilanciere ricevendolo a braccia tese, poi completa la distensione delle gambe.'),
  ('chest_to_bar','Trazioni petto alla sbarra','Parti appeso con spalle attive e corpo compatto. Tira i gomiti indietro portando la parte alta del petto alla sbarra, poi torna a braccia distese in controllo.'),
  ('bar_muscle_up','Muscle-up alla sbarra','Genera una tirata alta portando anche e petto verso la sbarra. Passa rapidamente il busto sopra la barra e completa spingendo fino a braccia distese.'),
  ('toes_to_bar','Piedi alla sbarra','Parti appeso con spalle attive e avvia una piccola oscillazione controllata. Fletti anche e addome portando entrambi i piedi alla sbarra, poi ritorna compatto.'),
  ('handstand_pushup','Piegamenti in verticale','Mettiti in verticale al muro con mani poco più larghe delle spalle. Scendi con la testa verso il pavimento e spingi fino a distendere i gomiti mantenendo il corpo compatto.'),
  ('pistol_squat','Squat a una gamba','Tieni una gamba distesa davanti e scendi sull’altra mantenendo il tallone a terra. Raggiungi la profondità controllata e risali spingendo attraverso tutto il piede.')
)
update public.exercises e
set name = crossfit_cues.italian_name,
    instructions = crossfit_cues.cue,
    description = crossfit_cues.cue
from crossfit_cues
where e.id = crossfit_cues.id;
