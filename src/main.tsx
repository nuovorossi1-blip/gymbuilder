import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { installGlobalErrorLogging } from './lib/jsErrorLog'
import { registerGymBuilderServiceWorker } from './pwa'

installGlobalErrorLogging()
registerGymBuilderServiceWorker()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
