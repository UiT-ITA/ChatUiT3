import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { msalInstance } from './msalInstance'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { SettingsProvider } from './contexts/SettingsContext.tsx'
import { registerBuiltinClientTools } from './services/clientTools/builtin'

export function renderApp(): void {
  registerBuiltinClientTools()

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
}
