import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CivicAuthProvider } from '@civic/auth-web3/react'
import './index.css'
import App from './App.jsx'

const clientId = import.meta.env.VITE_CIVIC_CLIENT_ID || "";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CivicAuthProvider clientId={clientId}>
      <App />
    </CivicAuthProvider>
  </StrictMode>,
)
