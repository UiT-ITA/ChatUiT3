/* global console, Office */

/** Returns the signed-in Office user's name, or undefined when Office does not provide it. */
export async function getOfficeLoginHint(): Promise<string | undefined> {
  try {
    const authContext = await Office.auth.getAuthContext();
    return authContext.userPrincipalName || undefined;
  } catch (error) {
    console.log(`Unable to get the Office user's name: ${error}`);
    return undefined;
  }
}
