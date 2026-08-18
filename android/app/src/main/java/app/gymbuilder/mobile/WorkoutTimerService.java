package app.gymbuilder.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

public class WorkoutTimerService extends Service {
    public static final String ACTION_START = "app.gymbuilder.mobile.START_WORKOUT_TIMER";
    public static final String ACTION_STOP = "app.gymbuilder.mobile.STOP_WORKOUT_TIMER";
    public static final String EXTRA_LABEL = "label";
    public static final String EXTRA_DEADLINE = "deadline";
    private static final String CHANNEL_ACTIVE = "gymbuilder_workout_timer";
    private static final String CHANNEL_ALERTS = "gymbuilder_timer_alerts";
    private static final int NOTIFICATION_ID = 4201;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable completion;
    private PowerManager.WakeLock wakeLock;

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
            if (deadline <= System.currentTimeMillis()) {
                // Questo Service e' stato avviato con startForegroundService(): il sistema
                // pretende startForeground() entro pochi secondi da OGNI esito, non solo da
                // quello valido, altrimenti termina l'intero processo con
                // ForegroundServiceDidNotStartInTimeException - un crash lanciato dal sistema
                // DOPO che onStartCommand() e' gia' tornato, quindi il try/catch qui sopra non
                // puo' intercettarlo. Un deadline gia' scaduto arriva quando il tick React che
                // lo calcola viene eseguito in ritardo (throttling in background/schermo spento).
                promoteToForegroundThenStop(safeLabel);
                return START_NOT_STICKY;
            }
            startTimer(safeLabel, deadline);
        } catch (RuntimeException error) {
            stopTimerSafely();
        }
        return START_NOT_STICKY;
    }

    private void startTimer(String label, long deadline) {
        acquireWakeLock(deadline - System.currentTimeMillis());
        Notification notification = buildCountdown(label, deadline);
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
            ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type);

        if (completion != null) handler.removeCallbacks(completion);
        completion = () -> {
            try {
                completeTimer(label);
            } catch (RuntimeException error) {
                stopTimerSafely();
            }
        };
        handler.postDelayed(completion, Math.max(0L, deadline - System.currentTimeMillis()));
    }

    private void promoteToForegroundThenStop(String label) {
        Notification notification = buildCountdown(label, System.currentTimeMillis());
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
            ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type);
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

    private Notification buildCountdown(String label, long deadline) {
        return new NotificationCompat.Builder(this, CHANNEL_ACTIVE)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(label)
            .setContentText("Timer attivo · tocca per tornare all’allenamento")
            .setContentIntent(openWorkoutIntent())
            .setCategory("workout")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setWhen(deadline)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            // Contenuto pieno anche a schermo bloccato: senza questo, sul lock screen puo'
            // comparire solo "notifica nascosta" invece del countdown vero e proprio.
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build();
    }

    private void completeTimer(String label) {
        releaseWakeLock();
        vibrateLong();
        Notification completed = new NotificationCompat.Builder(this, CHANNEL_ALERTS)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("⏱️ Tempo terminato")
            .setContentText(label + " · tocca per continuare l’allenamento")
            .setContentIntent(openWorkoutIntent())
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setVibrate(new long[] { 0, 1200 })
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build();
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(NOTIFICATION_ID + 1, completed);
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
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
        NotificationChannel alerts = new NotificationChannel(CHANNEL_ALERTS, "Scadenze timer", NotificationManager.IMPORTANCE_HIGH);
        alerts.setDescription("Avvisi per inizio lavoro e fine recupero");
        alerts.enableVibration(true);
        alerts.setVibrationPattern(new long[] { 0, 1200 });
        manager.createNotificationChannel(alerts);
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
