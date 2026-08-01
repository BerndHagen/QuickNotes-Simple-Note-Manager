import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// The canvas shows around the inset workspace frame, so it lives on <body>.
document.body.classList.add('qn-canvas')
import { Toaster } from 'react-hot-toast'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster 
      position="bottom-right"
      toastOptions={{
        className: '',
        style: {
          background: '#1f2937',
          color: '#f9fafb',
        },
      }}
    />
  </React.StrictMode>,
)
