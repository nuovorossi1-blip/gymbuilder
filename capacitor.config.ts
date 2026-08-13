import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.gymbuilder.mobile',
  appName: 'GymBuilder',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://gymbuilder-lemon.vercel.app',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
