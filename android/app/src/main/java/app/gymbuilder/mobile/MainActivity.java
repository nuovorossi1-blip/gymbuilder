package app.gymbuilder.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** true quando l'app e' sullo schermo (03/11): i suoni nativi del timer servono solo fuori,
     *  dentro suona gia' il timer web e si sentirebbero doppi. */
    static volatile boolean inPrimoPiano = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        CrashLogger.install(getApplicationContext());
        registerPlugin(ApkUpdaterPlugin.class);
        registerPlugin(WorkoutTimerPlugin.class);
        registerPlugin(DiagnosticsPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        inPrimoPiano = true;
    }

    @Override
    public void onPause() {
        inPrimoPiano = false;
        super.onPause();
    }
}
