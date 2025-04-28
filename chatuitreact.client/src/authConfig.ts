export const msalConfig = {
    auth: {
        clientId: "ec50c71e-1910-45bf-ba2a-eb463d80c024", // Replace with your EntraID application ID
        authority: "https://login.microsoftonline.com/4e7f212d-74db-4563-a57b-8ae44ed05526", // Replace with your tenant ID
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

export const loginRequest = {
    scopes: ["User.Read", "openid", "profile"]
};
