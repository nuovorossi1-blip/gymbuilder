package app.gymbuilder.mobile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.nio.file.Files;

/** Espone alla WebView il log dei crash nativi scritto da CrashLogger, cosi' l'utente puo'
 *  leggerlo e copiarlo direttamente dall'app senza bisogno di un file manager o di adb. */
@CapacitorPlugin(name = "Diagnostics")
public class DiagnosticsPlugin extends Plugin {
    @PluginMethod
    public void readCrashLog(PluginCall call) {
        JSObject result = new JSObject();
        try {
            File file = CrashLogger.logFile(getContext());
            result.put("content", file.exists() ? new String(Files.readAllBytes(file.toPath())) : "");
        } catch (Exception error) {
            result.put("content", "");
        }
        call.resolve(result);
    }

    @PluginMethod
    public void clearCrashLog(PluginCall call) {
        File file = CrashLogger.logFile(getContext());
        if (file.exists()) file.delete();
        call.resolve();
    }
}
