package app.gymbuilder.mobile;

import android.content.Context;
import android.util.Log;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Cattura ogni eccezione fatale non gestita (inclusa una lanciata dal sistema come
 * ForegroundServiceDidNotStartInTimeException, che arriva comunque sul thread principale come
 * eccezione Java normale) e la scrive su file, cosi' un crash segnalato dall'utente puo' essere
 * diagnosticato da un vero stack trace invece che per sola lettura del codice. Non sostituisce
 * l'handler di default: lo richiama sempre dopo aver scritto il log, cosi' il comportamento di
 * chiusura resta quello standard di Android.
 */
public final class CrashLogger {
    private static final String TAG = "GymBuilderCrash";

    private CrashLogger() { }

    public static void install(Context context) {
        Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            try {
                appendToFile(context, throwable);
            } catch (Throwable ignored) {
                // La scrittura del log non deve mai impedire la normale gestione del crash.
            }
            Log.e(TAG, "Crash fatale non gestito", throwable);
            if (previous != null) previous.uncaughtException(thread, throwable);
        });
    }

    public static File logFile(Context context) {
        File dir = context.getExternalFilesDir(null);
        if (dir == null) dir = context.getFilesDir();
        return new File(dir, "crash_log.txt");
    }

    private static void appendToFile(Context context, Throwable throwable) throws Exception {
        String timestamp = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.ITALY).format(new Date());
        StringWriter stack = new StringWriter();
        throwable.printStackTrace(new PrintWriter(stack));
        try (FileWriter writer = new FileWriter(logFile(context), true)) {
            writer.write("\n=== " + timestamp + " ===\n");
            writer.write(stack.toString());
            writer.write("\n");
        }
    }
}
