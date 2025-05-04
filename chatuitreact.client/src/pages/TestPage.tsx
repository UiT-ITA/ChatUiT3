import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ChatSummary {
  id: string;
  name: string;
}

interface ChatDetail {
  id: string;
  name: string;
  // add other properties as needed for the detailed view
}

interface ChatCreate {
  name: string;
}

function TestPage() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatDetail | null>(null);
  const [newChatName, setNewChatName] = useState('');
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

  async function fetchLastChatDetail() {
    if (chats.length === 0) {
      setError('No chat available.');
      return;
    }

    const lastChat = chats[chats.length - 1];

    try {
      const token = await getAccessToken();

      if (!token) {
        setError('No access token available. Please log in again.');
        return;
      }

      const response = await fetch(`/api/chats/${lastChat.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json() as ChatDetail;
        setSelectedChat(data);
        setError(null);
      } else if (response.status === 404) {
        setSelectedChat(null);
        setError('Chat not found.');
      } else {
        setError(`Failed to fetch chat: ${response.status} ${response.statusText}`);
        console.error("API request failed:", response.status, response.statusText);
      }
    } catch (error) {
      setError(`Error fetching chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Error fetching chat:', error);
    }
  }

  async function createChat() {
    try {
      const token = await getAccessToken();

      if (!token) {
        setError('No access token available. Please log in again.');
        return;
      }

      const chatCreate: ChatCreate = { name: newChatName };
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(chatCreate)
      });

      if (response.ok || response.status === 201) {
        const data = await response.json() as ChatDetail;
        setChats(prev => [...prev, { id: data.id, name: data.name }]);
        setSelectedChat(data);
        setNewChatName('');
        setError(null);
      } else {
        setError(`Failed to create chat: ${response.status} ${response.statusText}`);
        console.error("API request failed:", response.status, response.statusText);
      }
    } catch (error) {
      setError(`Error creating chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Error creating chat:', error);
    }
  }

  async function deleteChat(chatId: string) {
    try {
      const token = await getAccessToken();

      if (!token) {
        setError('No access token available. Please log in again.');
        return;
      }

      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 204) {
        setChats(prev => prev.filter(chat => chat.id !== chatId));
        if (selectedChat && selectedChat.id === chatId) {
          setSelectedChat(null);
        }
        setError(null);
      } else {
        setError(`Failed to delete chat: ${response.status} ${response.statusText}`);
        console.error("API request failed:", response.status, response.statusText);
      }
    } catch (error) {
      setError(`Error deleting chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Error deleting chat:', error);
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
                <li key={chat.id}>
                  {chat.name}
                  <button onClick={() => deleteChat(chat.id)}>Delete</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <hr />

      <div>
        <h2>Create a New Chat</h2>
        <input
          type="text"
          placeholder="Chat name"
          value={newChatName}
          onChange={e => setNewChatName(e.target.value)}
        />
        <button onClick={createChat}>Create Chat</button>
      </div>

      <hr />

      <div>
        <h2>Get Last Chat Detail</h2>
        <button onClick={fetchLastChatDetail} disabled={chats.length === 0}>
          Fetch Last Chat Detail
        </button>
        {selectedChat && (
          <div>
            <h3>Chat Detail</h3>
            <p>ID: {selectedChat.id}</p>
            <p>Name: {selectedChat.name}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TestPage;