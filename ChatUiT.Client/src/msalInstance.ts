import { PublicClientApplication, createNestablePublicClientApplication, type IPublicClientApplication } from '@azure/msal-browser'
import { msalConfig } from './authConfig'

let instance: IPublicClientApplication = new PublicClientApplication(msalConfig)

/** The MSAL client. Read it on every use: Teams replaces it at start-up. */
export function getMsal(): IPublicClientApplication {
  return instance
}

/** Replaces the client with one that signs in through the host's nested app authentication (Teams). */
export async function switchToNestedAppAuth(): Promise<void> {
  instance = await createNestablePublicClientApplication(msalConfig)
}
