import { app } from '@microsoft/teams-js'

const TEAMS_LAUNCH_KEY = 'chatuit.teamsLaunch'

/**
 * True when the Teams app opened this page. Its tab URL has `?host=teams`. The flag is kept in
 * sessionStorage, because the app's own navigation drops the query.
 */
export function isTeamsLaunch(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('host') === 'teams') {
      sessionStorage.setItem(TEAMS_LAUNCH_KEY, '1')
    }
    return sessionStorage.getItem(TEAMS_LAUNCH_KEY) === '1'
  } catch {
    return new URLSearchParams(window.location.search).get('host') === 'teams'
  }
}

/** Forgets the Teams launch, for a page that turned out not to run in Teams. */
export function clearTeamsLaunch(): void {
  try {
    sessionStorage.removeItem(TEAMS_LAUNCH_KEY)
  } catch {
    // No sessionStorage.
  }
}

/** Connects to Teams, which also sets up the nested app authentication bridge, and returns the signed-in user's login hint. */
export async function initializeTeams(): Promise<string | undefined> {
  await app.initialize()
  const context = await app.getContext()
  return context.user?.loginHint || context.user?.userPrincipalName || undefined
}
