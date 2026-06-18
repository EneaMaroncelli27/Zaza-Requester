import React from 'react'
import { createRoot } from 'react-dom/client'
import InterceptApp from './intercept/InterceptApp'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InterceptApp />
  </React.StrictMode>
)
