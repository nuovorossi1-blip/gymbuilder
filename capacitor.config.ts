import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.gymbuilder.mobile',
  appName: 'GymBuilder',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    // 03/11/2026: Vercel in pausa (402), l'app è servita dal PC su gym.redapp.dev (Cloudflare
    // Tunnel). Al ritorno su Vercel rimettere https://gymbuilder-lemon.vercel.app e rifare l'APK.
    url: 'https://gym.redapp.dev',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    // 04/11 (Rossi): con Android 15 l'app finiva sotto la barra dei pulsanti di sistema e
    // copriva "Correggi" e "Serie completata": la WebView ora lascia lo spazio delle barre.
    adjustMarginsForEdgeToEdge: 'auto',
  },
}

export default config
