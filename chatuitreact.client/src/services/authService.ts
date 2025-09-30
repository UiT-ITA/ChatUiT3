import { PublicClientApplication, AuthenticationResult, AccountInfo, InteractionRequiredAuthError } from "@azure/msal-browser";
import { msalConfig, loginRequest, apiRequest } from "../authConfig";

class AuthService {
    private msalInstance: PublicClientApplication;
    private initialized: boolean = false;
    private isInteractionInProgress: boolean = false;
  
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
            const result = await this.msalInstance.handleRedirectPromise();
            
            // Reset interaction flag after handling redirect
            if (result) {
                this.isInteractionInProgress = false;
            }
            
            return result;
        } catch (error) {
            console.error("Error during MSAL initialization:", error);
            this.isInteractionInProgress = false; // Reset on error
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

        if (!this.initialized) {
            await this.initialize();
        }

        this.ensureInitialized();

        const account = this.getAccount();
        if (!account) {
            // Check if we're already trying to authenticate
            if (this.isInteractionInProgress) {
                return null;
            }
            
            // No account found, user needs to login
            this.isInteractionInProgress = true;
            this.login();
            return null;
        }

        // Reset the flag if we have an account
        this.isInteractionInProgress = false;

        try {
            // Try to get token silently
            const response = await this.msalInstance.acquireTokenSilent({
                ...apiRequest,
                account: account,
                // forceRefresh: true
            });
            return response.accessToken;
        } catch (error) {
            console.error("Error getting access token:", error);
            
            await this.msalInstance.clearCache();
            
            if (!this.isInteractionInProgress) {
                this.isInteractionInProgress = true;
                this.msalInstance.loginRedirect(loginRequest);
            }
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
