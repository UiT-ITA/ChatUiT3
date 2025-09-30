import { AccountInfo, InteractionRequiredAuthError, BrowserAuthError } from "@azure/msal-browser";
import { msalInstance } from "../main";
import { loginRequest, apiRequest } from "../authConfig";

class AuthService {
  public async login(): Promise<void> {
    try {
      await msalInstance.loginRedirect(loginRequest);
    } catch (error) {
      if (error instanceof BrowserAuthError && 
          error.errorCode === 'interaction_in_progress') {
        return;
      }
      throw error;
    }
  }

  public logout(): void {
    msalInstance.logoutRedirect();
  }

  public getAccount(): AccountInfo | null {
    return msalInstance.getActiveAccount();
  }

  public async getAccessToken(): Promise<string | null> {
    const account = this.getAccount();
    if (!account) {
      this.login();
      return null;
    }

    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      const response = await msalInstance.acquireTokenSilent({
        ...apiRequest,
        account: account,
      });
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        msalInstance.acquireTokenRedirect({
          ...apiRequest,
          account: account,
        });
        return null;
      }
      console.error("Error getting access token:", error);
      throw error;
    }
  }

  public isAuthenticated(): boolean {
    return this.getAccount() !== null;
  }
}

const authService = new AuthService();
export default authService;
