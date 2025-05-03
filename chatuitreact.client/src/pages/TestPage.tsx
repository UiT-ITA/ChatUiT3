import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ChatSummary {
  id: string;
  name: string;
}

function TestPage() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, getAccessToken } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      fetchChats();
    }
  }, [isAuthenticated]);

  async function fetchChats() {
    try {
      setIsLoading(true);
      const token = await getAccessToken();

      if (!token) {
        setError('No access token available. Please log in again.');
        return;
      }

      const response = await fetch('/api/chats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json() as ChatSummary[];
        setChats(data);
        setError(null);
      } else {
        setError(`Failed to fetch chats: ${response.status} ${response.statusText}`);
        console.error("API request failed:", response.status, response.statusText);
      }
    } catch (error) {
      setError(`Error fetching chats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Error fetching chats:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="test-page">
      <h1>Chat List</h1>

      {isLoading && <p>Loading chats...</p>}
      {error && <p className="error">{error}</p>}

      {!isLoading && !error && (
        <div>
          {chats.length === 0 ? (
            <p>No chats found.</p>
          ) : (
            <ul>
              {chats.map(chat => (
                <li key={chat.id}>{chat.name}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default TestPage;