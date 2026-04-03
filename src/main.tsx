// Polyfill Buffer BEFORE xlsx is imported
if (typeof globalThis.Buffer === 'undefined' && typeof (window as any).electronAPI?.Buffer !== 'undefined') {
  globalThis.Buffer = (window as any).electronAPI.Buffer
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)