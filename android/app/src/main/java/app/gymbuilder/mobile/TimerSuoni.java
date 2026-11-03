package app.gymbuilder.mobile;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;

/**
 * Suoni del timer quando l'app e' in background (03/11/2026, richiesta di Rossi: "se uso il
 * telefono per altre cose, al termine deve suonare e vibrare"). Gli stessi suoni del timer web
 * (engine/audio.ts), sintetizzati qui: "tic" d'orologio, "ding" a campana, "bip" bassi e "bip
 * alto" da cronometro. Usano il volume della SVEGLIA (si sentono anche in modalita' silenziosa,
 * come un timer da cucina) e abbassano un attimo la musica invece di fermarla.
 */
final class TimerSuoni {
    private static final int RATE = 44_100;

    private TimerSuoni() {}

    /** tipo: tic | bip_basso | ding | bip_alto | beep | ring. Ogni errore viene ignorato. */
    static void suona(Context context, String tipo) {
        try {
            short[] pcm = sintetizza(tipo);
            if (pcm == null) return;
            AudioManager manager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            AudioAttributes attributi = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            AudioFocusRequest focus = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(attributi).build();
                manager.requestAudioFocus(focus);
            }
            AudioTrack track = new AudioTrack.Builder()
                .setAudioAttributes(attributi)
                .setAudioFormat(new AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build())
                .setTransferMode(AudioTrack.MODE_STATIC)
                .setBufferSizeInBytes(pcm.length * 2)
                .build();
            track.write(pcm, 0, pcm.length);
            final AudioFocusRequest focusFinale = focus;
            track.setNotificationMarkerPosition(pcm.length - 1);
            track.setPlaybackPositionUpdateListener(new AudioTrack.OnPlaybackPositionUpdateListener() {
                @Override public void onMarkerReached(AudioTrack t) {
                    try { t.release(); } catch (RuntimeException ignored) { }
                    if (focusFinale != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) manager.abandonAudioFocusRequest(focusFinale);
                }
                @Override public void onPeriodicNotification(AudioTrack t) { }
            });
            track.play();
        } catch (RuntimeException ignored) {
            // Il suono e' un aiuto: la vibrazione e la notifica restano comunque.
        }
    }

    /** Somma di sinusoidi che si spengono: [frequenza, volume, durata in secondi]. */
    private static short[] parziali(double[][] p) {
        double durata = 0;
        for (double[] x : p) durata = Math.max(durata, x[2]);
        int n = (int) (RATE * durata);
        short[] out = new short[n];
        for (int i = 0; i < n; i++) {
            double t = (double) i / RATE;
            double v = 0;
            for (double[] x : p) {
                if (t > x[2]) continue;
                double inviluppo = Math.exp(-5.0 * t / x[2]) * Math.min(1.0, t * 400); // attacco 2,5 ms
                v += x[1] * inviluppo * Math.sin(2 * Math.PI * x[0] * t);
            }
            out[i] = (short) Math.max(-32767, Math.min(32767, v * 32767));
        }
        return out;
    }

    private static short[] sintetizza(String tipo) {
        if (tipo == null) return null;
        switch (tipo) {
            case "tic": return parziali(new double[][] { { 2100, 0.45, 0.05 }, { 3300, 0.18, 0.03 } });
            case "bip_basso": return piatto(new double[][] { { 520, 0.5 }, { 1400, 0.16 }, { 2280, 0.08 } }, 0.5);
            case "bip_alto": return piatto(new double[][] { { 1100, 0.6 }, { 2200, 0.07 } }, 0.75);
            case "beep": return piatto(new double[][] { { 720, 0.5 }, { 2160, 0.12 } }, 1.0);
            case "ring": return parziali(new double[][] { { 587.33, 0.45, 1.8 }, { 1174.66, 0.35, 1.8 }, { 1760, 0.2, 1.8 } });
            case "ding": return parziali(new double[][] { { 880, 0.5, 2.2 }, { 2428.8, 0.22, 1.3 }, { 4752, 0.1, 0.77 }, { 7858.4, 0.04, 0.44 } });
            default: return null; // "silent" e valori sconosciuti
        }
    }

    /** Bip a volume costante (cronometro), con 10 ms di sfumatura all'inizio e alla fine. */
    private static short[] piatto(double[][] p, double durata) {
        int n = (int) (RATE * durata);
        short[] out = new short[n];
        int sfuma = RATE / 100;
        for (int i = 0; i < n; i++) {
            double t = (double) i / RATE;
            double v = 0;
            for (double[] x : p) v += x[1] * Math.sin(2 * Math.PI * x[0] * t);
            double g = Math.min(1.0, Math.min(i, n - 1 - i) / (double) sfuma);
            out[i] = (short) Math.max(-32767, Math.min(32767, v * g * 32767));
        }
        return out;
    }
}
