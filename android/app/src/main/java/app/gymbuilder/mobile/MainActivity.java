package app.gymbuilder.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        CrashLogger.install(getApplicationContext());
        registerPlugin(ApkUpdaterPlugin.class);
        registerPlugin(WorkoutTimerPlugin.class);
        registerPlugin(DiagnosticsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
