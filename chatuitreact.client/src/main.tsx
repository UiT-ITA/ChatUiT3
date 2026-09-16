import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { EventType, type AuthenticationResult } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalInstance } from './msalInstance'
import authService from './services/authService.ts'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { SettingsProvider } from './contexts/SettingsContext.tsx'

msalInstance.initialize().then(() => {
  if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length > 0) {
    msalInstance.setActiveAccount(msalInstance.getAllAccounts()[0])
  }

  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const payload = event.payload as AuthenticationResult
      if (payload.account) {
        msalInstance.setActiveAccount(payload.account)
      }
    }
    if (event.eventType === EventType.LOGIN_SUCCESS ||
        event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS) {
      authService.clearRedirectGuard()
    }
  })

  const container = document.getElementById('root')
  const root = createRoot(container!)

  root.render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <SettingsProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </SettingsProvider>
      </MsalProvider>
    </StrictMode>
  )
})
