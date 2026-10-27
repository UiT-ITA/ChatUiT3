// Auth shell: decides whether the user is signed in before the app bundle is
// fetched, so a signed-out user is redirected to login without downloading
// and parsing the whole app first.
import { EventType, type AuthenticationResult } from '@azure/msal-browser'
import { msalInstance } from './msalInstance'
import authService from './services/authService.ts'

const loadApp = () => import('./bootstrap.tsx')

async function start(): Promise<void> {
  await msalInstance.initialize()

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

  // Returning from login, or already signed in: start fetching the app while
  // the redirect response is processed.
  const isRedirectResponse = /[#&](code|error)=/.test(window.location.hash)
  let app = isRedirectResponse || msalInstance.getAllAccounts().length > 0 ? loadApp() : null

  try {
    await msalInstance.handleRedirectPromise()
  } catch (error) {
    console.error('Login redirect failed:', error)
  }

  if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length > 0) {
    msalInstance.setActiveAccount(msalInstance.getAllAccounts()[0])
  }

  // Resolves false when a redirect to login has started instead.
  let hasToken = Promise.resolve(true)

  if (!msalInstance.getActiveAccount()) {
    try {
      await authService.login()
      return
    } catch (error) {
      // The loop guard refused to redirect again. Load the app so it can
      // handle the signed-out state as before.
      console.error('Login error:', error)
    }
  } else {
    // Overlap the API token request with the app download. A cached account
    // whose session has expired redirects here, before the app renders.
    hasToken = authService.getAccessToken().then(token => token !== null, () => true)
  }

  app ??= loadApp()
  const [{ renderApp }, proceed] = await Promise.all([app, hasToken])
  if (proceed) {
    renderApp()
  }
}

start()
