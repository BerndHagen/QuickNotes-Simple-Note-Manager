import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import '@fontsource/bitter/latin-400.css'
import '@fontsource/bitter/latin-700.css'
import '@fontsource/cabin/latin-400.css'
import '@fontsource/cabin/latin-700.css'
import '@fontsource/crimson-pro/latin-400.css'
import '@fontsource/crimson-pro/latin-700.css'
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-700.css'
import '@fontsource/fira-code/latin-400.css'
import '@fontsource/fira-code/latin-700.css'
import '@fontsource/fira-sans/latin-400.css'
import '@fontsource/fira-sans/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-700.css'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import '@fontsource/ibm-plex-serif/latin-400.css'
import '@fontsource/ibm-plex-serif/latin-700.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import '@fontsource/karla/latin-400.css'
import '@fontsource/karla/latin-700.css'
import '@fontsource/lato/latin-400.css'
import '@fontsource/lato/latin-700.css'
import '@fontsource/lexend/latin-400.css'
import '@fontsource/lexend/latin-700.css'
import '@fontsource/libre-baskerville/latin-400.css'
import '@fontsource/libre-baskerville/latin-700.css'
import '@fontsource/lora/latin-400.css'
import '@fontsource/lora/latin-700.css'
import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/merriweather/latin-400.css'
import '@fontsource/merriweather/latin-700.css'
import '@fontsource/montserrat/latin-400.css'
import '@fontsource/montserrat/latin-700.css'
import '@fontsource/noto-sans/latin-400.css'
import '@fontsource/noto-sans/latin-700.css'
import '@fontsource/noto-serif/latin-400.css'
import '@fontsource/noto-serif/latin-700.css'
import '@fontsource/nunito-sans/latin-400.css'
import '@fontsource/nunito-sans/latin-700.css'
import '@fontsource/open-sans/latin-400.css'
import '@fontsource/open-sans/latin-700.css'
import '@fontsource/playfair-display/latin-400.css'
import '@fontsource/playfair-display/latin-700.css'
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/pt-sans/latin-400.css'
import '@fontsource/pt-sans/latin-700.css'
import '@fontsource/pt-serif/latin-400.css'
import '@fontsource/pt-serif/latin-700.css'
import '@fontsource/raleway/latin-400.css'
import '@fontsource/raleway/latin-700.css'
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-700.css'
import '@fontsource/roboto-mono/latin-400.css'
import '@fontsource/roboto-mono/latin-700.css'
import '@fontsource/roboto-slab/latin-400.css'
import '@fontsource/roboto-slab/latin-700.css'
import '@fontsource/source-code-pro/latin-400.css'
import '@fontsource/source-code-pro/latin-700.css'
import '@fontsource/source-sans-3/latin-400.css'
import '@fontsource/source-sans-3/latin-700.css'
import '@fontsource/source-serif-4/latin-400.css'
import '@fontsource/source-serif-4/latin-700.css'
import '@fontsource/space-mono/latin-400.css'
import '@fontsource/space-mono/latin-700.css'
import '@fontsource/ubuntu/latin-400.css'
import '@fontsource/ubuntu/latin-700.css'
import '@fontsource/work-sans/latin-400.css'
import '@fontsource/work-sans/latin-700.css'
import './index.css'

import { Toaster } from 'react-hot-toast'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      gutter={8}
      containerStyle={{
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        right: 'max(16px, env(safe-area-inset-right))',
      }}
      toastOptions={{
        duration: 4000,
        style: {
          maxWidth: 'min(420px, calc(100vw - 32px))',
          border: '1px solid var(--qn-border-strong)',
          borderRadius: 'var(--qn-radius-card)',
          background: 'var(--qn-surface-raised)',
          color: 'var(--qn-text)',
          boxShadow: 'var(--qn-shadow-lg)',
        },
        success: {
          iconTheme: {
            primary: 'var(--qn-success)',
            secondary: 'var(--qn-success-soft)',
          },
        },
        error: {
          iconTheme: {
            primary: 'var(--qn-danger)',
            secondary: 'var(--qn-danger-soft)',
          },
        },
      }}
    />
  </React.StrictMode>,
)
