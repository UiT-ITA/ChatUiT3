/** The app registration and tenant. */
export const msalAuth = {
  clientId: "ec50c71e-1910-45bf-ba2a-eb463d80c024",
  authority: "https://login.microsoftonline.com/4e7f212d-74db-4563-a57b-8ae44ed05526",
};

/** The token a sign-in dialog returns. expiresOn is an ISO date, or null when it is unknown. */
export type DialogToken = { accessToken: string; expiresOn: string | null };

/** The message the sign-in dialog sends to the task pane. */
export type DialogAuthMessage = ({ status: "success" } & DialogToken) | { status: "error"; message: string };
