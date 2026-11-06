import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { msalInstance } from './msalInstance'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { SettingsProvider } from './contexts/SettingsContext.tsx'
import { registerBuiltinClientTools } from './services/clientTools/builtin'
import { startTelemetry, trackError } from './services/telemetryService'

export function renderApp(): void {
  registerBuiltinClientTools()
  startTelemetry()

  const container = document.getElementById('root')
  const root = createRoot(container!, {
    onUncaughtError: (error) => {
      trackError('render', { message: 'A component failed to render', error })
      console.error(error)
    },
  })

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
