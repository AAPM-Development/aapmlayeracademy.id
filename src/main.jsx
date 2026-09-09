import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@ten4seven/ui/styles.css'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Install support remains optional; a registration failure must not
      // prevent the Academy shell from rendering.
    });
  });
}
