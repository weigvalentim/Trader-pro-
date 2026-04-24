import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// ── Inicialização do Capacitor ──────────────────────────────────
// Só executa quando rodando dentro do app Android/iOS
async function initCapacitor() {
  try {
    const { App: CapApp } = await import('@capacitor/app')
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    const { SplashScreen } = await import('@capacitor/splash-screen')

    // Barra de status preta
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#000000' })

    // Esconde splash após React montar
    await SplashScreen.hide()

    // Botão "voltar" do Android — sai do app apenas na tela inicial
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        CapApp.exitApp()
      } else {
        window.history.back()
      }
    })
  } catch {
    // Não está rodando no Capacitor (ex: navegador), ignora silenciosamente
  }
}

// ── Registra o Service Worker (PWA) ────────────────────────────
// O vite-plugin-pwa injeta o registro automaticamente no build,
// mas deixamos aqui como referência para controle manual se necessário.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// ── Monta o React ───────────────────────────────────────────────
initCapacitor()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
