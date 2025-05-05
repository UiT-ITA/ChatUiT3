import { PublicClientApplication, AuthenticationResult, AccountInfo, InteractionRequiredAuthError } from "@azure/msal-browser";
import { msalConfig, loginRequest, apiRequest } from "../authConfig";

class AuthService {
    private msalInstance: PublicClientApplication;
    private initialized: boolean = false;
  
    constructor() {
        this.msalInstance = new PublicClientApplication(msalConfig);
    }

    /**
    * Initialize the authentication service
    * This should be called once when your app starts
    */
    public async initialize(): Promise<AuthenticationResult | null> {
        try {
            await this.msalInstance.initialize();
            this.initialized = true;

            // Handle the redirect flow if coming back from login
            return await this.msalInstance.handleRedirectPromise();
        } catch (error) {
            console.error("Error during MSAL initialization:", error);
            return null;
        }
    }

    /**
    * Ensures MSAL is initialized before calling any method
    */
    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error("AuthService not initialized. Call initialize() first.");
        }
    }

    /**
    * Start the login process (redirects to Microsoft login page)
    */
    public login(): void {
        this.ensureInitialized();
        this.msalInstance.loginRedirect(loginRequest);
    }

    /**
    * Log the user out
    */
    public logout(): void {
        this.ensureInitialized();
        this.msalInstance.logoutRedirect();
    }

    /**
    * Get the account of the currently signed-in user
    * Returns null if no user is signed in
    */
    public getAccount(): AccountInfo | null {
        if (!this.initialized) return null;

        const accounts = this.msalInstance.getAllAccounts();
        if (accounts.length === 0) {
            return null;
        }
        return accounts[0];
    }

    /**
    * Get an access token silently, or redirect to login if necessary
    */
    public async getAccessToken(): Promise<string | null> {
        this.ensureInitialized();

        const account = this.getAccount();
        if (!account) {
            // No account found, user needs to login
            this.login();
            return null;
        }

        try {
            // Try to get token silently
            const response = await this.msalInstance.acquireTokenSilent({
                ...apiRequest,
                account: account,
                forceRefresh: true
            });
            return response.accessToken;
        } catch (error) {
            // If silent token acquisition fails, try interactive method
            if (error instanceof InteractionRequiredAuthError) {
                this.msalInstance.acquireTokenRedirect(loginRequest);
            }
            console.error("Error getting access token:", error);
            return null;
        }
    }

    /**
    * Check if user is authenticated
    */
    public isAuthenticated(): boolean {
        return this.getAccount() !== null;
    }

    /**
    * Get the MSAL instance (useful for advanced scenarios)
    */
    public getMsalInstance(): PublicClientApplication {
        this.ensureInitialized();
        return this.msalInstance;
    }
}

// Export a singleton instance
const authService = new AuthService();
export default authService;

