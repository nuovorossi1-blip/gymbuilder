package app.gymbuilder.mobile;

import android.Manifest;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "WorkoutTimer",
    permissions = @Permission(alias = "notifications", strings = Manifest.permission.POST_NOTIFICATIONS)
)
public class WorkoutTimerPlugin extends Plugin {
    // Il Runner chiama start() a ogni cambio di fase/round (lavoro->riposo, serie->recupero,
    // ecc.), spesso a distanza di pochi secondi. Senza questi due flag, ogni chiamata con
    // permesso non ancora concesso richiedeva di nuovo il permesso: due richieste sovrapposte
    // (una gia' in corso, una nuova) o richieste ripetute dopo un rifiuto esplicito possono far
    // crashare il bridge dei permessi di Capacitor. Una volta chiesto (concesso o negato), non
    // si richiede piu' per il resto della sessione dell'app.
    private boolean permissionRequestInFlight = false;
    private boolean permissionDenied = false;

    // Chiesto esplicitamente prima del countdown iniziale (vedi requestTimerNotifications()
    // lato JS), cosi' il dialogo di sistema per il permesso notifiche non compare a meta'
    // del primo round: senza questo, start() lo richiedeva implicitamente al primo cambio
    // di fase, in corsa con i round successivi (Tabata ne cambia uno ogni 10-20s), e la
    // richiesta poteva restare "in flight" per piu' round consecutivi.
    @PluginMethod
    public void ensurePermission(PluginCall call) {
        boolean needsPermission = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && getPermissionState("notifications") != PermissionState.GRANTED;
        if (!needsPermission) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        if (permissionDenied || permissionRequestInFlight) {
            JSObject result = new JSObject();
            result.put("granted", false);
            call.resolve(result);
            return;
        }
        permissionRequestInFlight = true;
        requestPermissionForAlias("notifications", call, "ensurePermissionResult");
    }

    @PermissionCallback
    private void ensurePermissionResult(PluginCall call) {
        permissionRequestInFlight = false;
        boolean granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || getPermissionState("notifications") == PermissionState.GRANTED;
        if (!granted) permissionDenied = true;
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void start(PluginCall call) {
        boolean needsPermission = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && getPermissionState("notifications") != PermissionState.GRANTED;
        if (needsPermission) {
            if (permissionDenied || permissionRequestInFlight) {
                JSObject result = new JSObject();
                result.put("started", false);
                result.put("notificationsGranted", false);
                call.resolve(result);
                return;
            }
            permissionRequestInFlight = true;
            requestPermissionForAlias("notifications", call, "permissionResult");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        permissionRequestInFlight = false;
        boolean granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || getPermissionState("notifications") == PermissionState.GRANTED;
        if (!granted) {
            permissionDenied = true;
            JSObject result = new JSObject();
            result.put("started", false);
            result.put("notificationsGranted", false);
            call.resolve(result);
            return;
        }
        startService(call);
    }

    private void startService(PluginCall call) {
        String label = call.getString("label", "Timer allenamento");
        Long deadline = call.getLong("deadline");
        if (deadline == null || deadline <= System.currentTimeMillis()) {
            call.reject("Scadenza timer non valida");
            return;
        }
        Intent intent = new Intent(getContext(), WorkoutTimerService.class)
            .setAction(WorkoutTimerService.ACTION_START)
            .putExtra(WorkoutTimerService.EXTRA_LABEL, label)
            .putExtra(WorkoutTimerService.EXTRA_DEADLINE, deadline);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(intent);
            else getContext().startService(intent);
        } catch (RuntimeException error) {
            // Il timer React continua a funzionare anche se Android rifiuta il
            // foreground service (permessi, restrizioni del produttore, ecc.).
            JSObject fallback = new JSObject();
            fallback.put("started", false);
            fallback.put("notificationsGranted", Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || getPermissionState("notifications") == PermissionState.GRANTED);
            call.resolve(fallback);
            return;
        }
        JSObject result = new JSObject();
        result.put("started", true);
        result.put("notificationsGranted", Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), WorkoutTimerService.class)
            .setAction(WorkoutTimerService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve();
    }
}
