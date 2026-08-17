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
    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "permissionResult");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(intent);
        else getContext().startService(intent);
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
