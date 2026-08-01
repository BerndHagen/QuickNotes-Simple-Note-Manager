import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
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
