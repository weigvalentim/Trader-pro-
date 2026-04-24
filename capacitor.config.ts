import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // ── Identificação do app ─────────────────────────────────────
  appId: 'com.tradepro.app',         // ID único (mude se for publicar)
  appName: 'TradePro',

  // ── Pasta do build React ─────────────────────────────────────
  webDir: 'dist',

  // ── Servidor ─────────────────────────────────────────────────
  server: {
    androidScheme: 'https',          // Necessário para links externos funcionarem
    // url: 'http://SEU_IP:5173',    // ← Descomente para live reload em dev
    // cleartext: true,              // ← Descomente junto com o url acima
  },

  // ── Android ──────────────────────────────────────────────────
  android: {
    backgroundColor: '#000000',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // true apenas para debug
  },

  // ── Plugins ──────────────────────────────────────────────────
  plugins: {
    // Barra de status preta (combina com o app)
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#000000',
      overlaysWebView: false,
    },

    // Splash screen (opcional — exige imagens em android/res)
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
}

export default config
