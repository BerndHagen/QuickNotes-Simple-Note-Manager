import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/source-sans-3/400.css'
import '@fontsource/source-sans-3/600.css'
import '@fontsource/nunito-sans/400.css'
import '@fontsource/nunito-sans/600.css'
import '@fontsource/lato/400.css'
import '@fontsource/lato/700.css'
import '@fontsource/merriweather/400.css'
import '@fontsource/merriweather/700.css'
import '@fontsource/source-serif-4/400.css'
import '@fontsource/source-serif-4/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './index.css'

// The body owns the shared canvas behind both authentication and workspace layouts.
document.body.classList.add('qn-canvas')
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
