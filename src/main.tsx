import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import 'react-day-picker/style.css'
import './index.css'

if (new URL(window.location.href).searchParams.get('selfTest') === '1') {
  void import('./app/selfTest').then((m) => m.registerSelfTest())
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
