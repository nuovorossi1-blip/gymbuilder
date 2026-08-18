package app.gymbuilder.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.widget.RemoteViews;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

public class WorkoutTimerService extends Service {
    public static final String ACTION_START = "app.gymbuilder.mobile.START_WORKOUT_TIMER";
    public static final String ACTION_STOP = "app.gymbuilder.mobile.STOP_WORKOUT_TIMER";
    public static final String EXTRA_LABEL = "label";
    public static final String EXTRA_DEADLINE = "deadline";
    /** 'work' | 'rest' | 'other' - decide il colore del countdown custom (sez. buildCountdown). */
    public static final String EXTRA_PHASE = "phase";
    /** Preferenza dell'app (Profilo), non del singolo allenamento: vedi timerSettings.ts lato JS. */
    public static final String EXTRA_VIBRATE = "vibrate";
    private static final String CHANNEL_ACTIVE = "gymbuilder_workout_timer";
    private static final int NOTIFICATION_ID = 4201;
    private static final int COLOR_WORK = 0xFFFFD600;
    private static final int COLOR_REST = 0xFF40C4FF;
    private static final int COLOR_OTHER = Color.WHITE;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable completion;
    private PowerManager.WakeLock wakeLock;
    private boolean vibrateEnabled = true;
    // true dal momento in cui QUESTA istanza del Service ha soddisfatto il contratto
    // startForeground() dopo Context.startForegroundService(). Il Runner React riavvia il
    // timer a ogni cambio di fase/round (ogni 10-20s in un Tabata), spesso a schermo spento:
    // fermare e ricreare il Service a ogni round significa riaprire la finestra di 5s del
    // contratto a ogni round, in corsa con l'eventuale throttling del processo in background -
    // da cui i crash ForegroundServiceDidNotStartInTimeException osservati in serie ravvicinata.
    // Con questo flag, startForeground() viene chiamato una sola volta per sessione (primo
    // round): i round successivi, finche' l'istanza resta viva, si limitano ad aggiornare
    // notifica/wake lock/countdown senza mai passare di nuovo da startForegroundService().
    private boolean foregrounded = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannels();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Il timer React in WebView e' gia' la fonte di verita' del countdown: questo servizio
        // e' solo un miglioramento (notifica persistente + wake lock) quando l'app va in
        // background. Qualunque eccezione qui (restrizioni Android su foreground service,
        // permessi negati a runtime, produttori che bloccano i wake lock, ecc.) non deve mai
        // far crashare l'intera app: si spegne solo questo servizio, l'allenamento continua.
        try {
            if (intent == null) return START_NOT_STICKY;
            if (ACTION_STOP.equals(intent.getAction())) {
                stopTimer();
                return START_NOT_STICKY;
            }
            long deadline = intent.getLongExtra(EXTRA_DEADLINE, 0L);
            String label = intent.getStringExtra(EXTRA_LABEL);
            String safeLabel = label == null ? "Timer allenamento" : label;
            String phase = intent.getStringExtra(EXTRA_PHASE);
            String safePhase = phase == null ? "other" : phase;
            vibrateEnabled = intent.getBooleanExtra(EXTRA_VIBRATE, true);
            if (deadline <= System.currentTimeMillis()) {
                // Questo Service e' stato avviato con startForegroundService(): se non e' ancora
                // in foreground, il sistema pretende startForeground() entro pochi secondi anche
                // da un esito nullo, altrimenti termina l'intero processo con
                // ForegroundServiceDidNotStartInTimeException - un crash lanciato dal sistema
                // DOPO che onStartCommand() e' gia' tornato, quindi il try/catch qui sopra non
                // puo' intercettarlo. Un deadline gia' scaduto arriva quando il tick React che
                // lo calcola viene eseguito in ritardo (throttling in background/schermo spento).
                // Se invece la sessione e' gia' in corso (foregrounded), non c'e' nessun
                // contratto da rispettare: ci si ferma e basta.
                if (foregrounded) stopTimer(); else promoteToForegroundThenStop(safeLabel, safePhase);
                return START_NOT_STICKY;
            }
            if (foregrounded) updateTimer(safeLabel, deadline, safePhase); else startTimer(safeLabel, deadline, safePhase);
        } catch (RuntimeException error) {
            stopTimerSafely();
        }
        return START_NOT_STICKY;
    }

    private void startTimer(String label, long deadline, String phase) {
        acquireWakeLock(deadline - System.currentTimeMillis());
        Notification notification = buildCountdown(label, deadline, phase);
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
            ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type);
        foregrounded = true;
        scheduleCompletion(deadline);
    }

    /** Round successivo nella stessa sessione: nessuna nuova chiamata a startForeground. */
    private void updateTimer(String label, long deadline, String phase) {
        acquireWakeLock(deadline - System.currentTimeMillis());
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify(NOTIFICATION_ID, buildCountdown(label, deadline, phase));
        scheduleCompletion(deadline);
    }

    private void scheduleCompletion(long deadline) {
        if (completion != null) handler.removeCallbacks(completion);
        completion = () -> {
            try {
                completeTimer();
            } catch (RuntimeException error) {
                stopTimerSafely();
            }
        };
        handler.postDelayed(completion, Math.max(0L, deadline - System.currentTimeMillis()));
    }

    private void promoteToForegroundThenStop(String label, String phase) {
        Notification notification = buildCountdown(label, System.currentTimeMillis(), phase);
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
            ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type);
        foregrounded = true;
        stopTimer();
    }

    /** Come stopTimer(), ma non propaga eccezioni: usata nel percorso di recupero da errore. */
    private void stopTimerSafely() {
        try {
            stopTimer();
        } catch (RuntimeException ignored) {
            stopSelf();
        }
    }

    /**
     * Notifica completamente custom (sfondo nero, countdown grande) invece dello stile di
     * sistema: giallo durante il lavoro, blu durante il riposo, cosi' la fase si riconosce anche
     * senza leggere il testo. Il Chronometer di RemoteViews e' un widget nativo che l'OS aggiorna
     * da solo ogni secondo: nessun notify() ripetuto lato nostro, quindi nessun rischio di
     * spam/flicker di notifiche durante round brevi come nel Tabata.
     */
    private Notification buildCountdown(String label, long deadline, String phase) {
        RemoteViews content = buildCountdownViews(label, deadline, phase);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ACTIVE)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentIntent(openWorkoutIntent())
            .setCategory("workout")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setCustomContentView(content)
            .setCustomBigContentView(content)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            // Contenuto pieno anche a schermo bloccato: senza questo, sul lock screen puo'
            // comparire solo "notifica nascosta" invece del countdown vero e proprio.
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        return builder.build();
    }

    private RemoteViews buildCountdownViews(String label, long deadline, String phase) {
        RemoteViews views = new RemoteViews(getPackageName(), R.layout.notification_timer);
        views.setTextViewText(R.id.notification_timer_label, phaseTitle(phase));
        views.setTextViewText(R.id.notification_timer_title, label);
        views.setTextColor(R.id.notification_timer_chronometer, phaseColor(phase));
        // Chronometer conta da SystemClock.elapsedRealtime(), non da un epoch: va convertita la
        // deadline (wall clock, calcolata lato JS con Date.now()) nella stessa base temporale.
        long base = SystemClock.elapsedRealtime() + (deadline - System.currentTimeMillis());
        views.setChronometer(R.id.notification_timer_chronometer, base, null, true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            views.setChronometerCountDown(R.id.notification_timer_chronometer, true);
        }
        return views;
    }

    private static String phaseTitle(String phase) {
        if ("work".equals(phase)) return "LAVORO";
        if ("rest".equals(phase)) return "RIPOSO";
        return "TIMER ATTIVO";
    }

    private static int phaseColor(String phase) {
        if ("work".equals(phase)) return COLOR_WORK;
        if ("rest".equals(phase)) return COLOR_REST;
        return COLOR_OTHER;
    }

    private void completeTimer() {
        releaseWakeLock();
        // Solo vibrazione come segnale di cambio fase: prima qui si postava anche una notifica
        // separata a ogni round, che su un Tabata (round ogni 10-30s) diventava uno spam continuo
        // di popup/vibrazioni sovrapposte a quelle della UI in-app. Il countdown persistente
        // (gia' aggiornato dal round successivo via updateTimer) resta l'unico avviso visivo.
        if (vibrateEnabled) vibrateLong();
        // Non ferma il Service: la sessione prosegue col round successivo (updateTimer(), stesso
        // ServiceRecord). Si ferma solo su ACTION_STOP esplicito da JS a fine sessione vera.
    }

    private PendingIntent openWorkoutIntent() {
        Intent open = new Intent(this, MainActivity.class)
            .setAction(Intent.ACTION_VIEW)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, 42, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void acquireWakeLock(long durationMs) {
        releaseWakeLock();
        PowerManager manager = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = manager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GymBuilder::WorkoutTimer");
        wakeLock.acquire(Math.min(Math.max(durationMs + 5_000L, 10_000L), 3 * 60 * 60 * 1000L));
    }

    private void vibrateLong() {
        Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (!vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) vibrator.vibrate(VibrationEffect.createOneShot(1200, VibrationEffect.DEFAULT_AMPLITUDE));
        else vibrator.vibrate(1200);
    }

    private void stopTimer() {
        if (completion != null) handler.removeCallbacks(completion);
        releaseWakeLock();
        stopForeground(STOP_FOREGROUND_REMOVE);
        foregrounded = false;
        stopSelf();
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        NotificationChannel active = new NotificationChannel(CHANNEL_ACTIVE, "Timer allenamento", NotificationManager.IMPORTANCE_LOW);
        active.setDescription("Conto alla rovescia persistente dell’allenamento in corso");
        manager.createNotificationChannel(active);
        // Il canale "Scadenze timer" postava un popup separato a ogni cambio round: rimosso
        // (sez. completeTimer) perche' era spam su round brevi. Si elimina anche qui il canale
        // gia' creato sui device con una versione precedente dell'app installata.
        manager.deleteNotificationChannel("gymbuilder_timer_alerts");
    }

    @Override
    public void onDestroy() {
        if (completion != null) handler.removeCallbacks(completion);
        releaseWakeLock();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }
}
