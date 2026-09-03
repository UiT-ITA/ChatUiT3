export const msalConfig = {
    auth: {
        clientId: "ec50c71e-1910-45bf-ba2a-eb463d80c024",
        authority: "https://login.microsoftonline.com/4e7f212d-74db-4563-a57b-8ae44ed05526",
        redirectUri: window.location.origin,
    },
    cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: true,
    },
    system: {
        allowRedirectInIframe: true,    // Improves silent token acquisition
        tokenRenewalOffsetSeconds: 300  // Refresh tokens 5 minutes before expiry
    }
};

// Blank page used as redirect target for silent (iframe) token renewal,
// so the renewal iframe never loads the full SPA. Must be registered as a
// SPA redirect URI in the Entra app registration.
export const silentRedirectUri = `${window.location.origin}/blank.html`;

export const loginRequest = {
    scopes: ["User.Read", "openid", "profile"]
};

export const apiRequest = {
    scopes: ["api://ec50c71e-1910-45bf-ba2a-eb463d80c024/access_as_user"]
};