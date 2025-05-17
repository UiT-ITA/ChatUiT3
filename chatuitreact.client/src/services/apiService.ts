class ApiService {
    private async request<T>(
        endpoint: string, 
        token?: string, 
        options: RequestInit = {}
    ): Promise<T> {
        const headers = {
            ...(token && { "Authorization": `Bearer ${token}` }),
            ...(options.body && { "Content-Type": "application/json" })
        };

        const response = await fetch(endpoint, {
            ...options,
            headers: { ...headers, ...options.headers }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    public async get<T>(endpoint: string, token?: string): Promise<T> {
        return this.request<T>(endpoint, token);
    }

    public async post<T>(endpoint: string, data: any, token?: string): Promise<T> {
        return this.request<T>(endpoint, token, {
            method: "POST",
            body: JSON.stringify(data)
        });
    }

    public async delete(endpoint: string, token?: string): Promise<boolean> {
        try {
            await this.request(endpoint, token, { method: "DELETE" });
            return true;
        } catch {
            return false;
        }
    }
}

const apiService = new ApiService();
export default apiService;
