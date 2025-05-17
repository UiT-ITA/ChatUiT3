import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import chatService from '../../services/chatService';
import { ChatListItem } from '../../types/chatModels';

function useChatList() {
    const [chats, setChats] = useState<ChatListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { isAuthenticated, isInitializing } = useAuth();

    useEffect(() => {
        if (isInitializing) {
            return;
        }

        if (!isAuthenticated) {
            setChats([]);
            setLoading(false);
            return;
        }

        let unsubscribe: (() => void) | undefined;

        const setupConnection = async () => {
            try {
                // Subscribe to updates first
                unsubscribe = chatService.onChatListUpdated((chats) => {
                    setChats(chats);
                });
                
                // Then load initial chats (this will also ensure connection)
                const chats = await chatService.getChats();
                setChats(chats);
            } catch (error) {
                console.error("Failed to setup chat connection:", error);
            } finally {
                setLoading(false);
            }
        };

        setupConnection();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [isAuthenticated]);

    return { chats, loading };
}

export const ChatList = () => {
    const { chats, loading } = useChatList();
    const { isAuthenticated, isInitializing, login } = useAuth();

    if (isInitializing) {
        return (
            <div className="nav-section">
                <p className="loading-text">Initializing...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="nav-section">
                <p className="login-notice" style={{ color: '#ff9800', padding: '10px', textAlign: 'center' }}>
                    Please log in to see your chat history
                </p>
                <button 
                    onClick={login}
                    style={{
                        display: 'block',
                        margin: '10px auto',
                        padding: '8px 16px',
                        backgroundColor: '#4285f4',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Log In
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="nav-section">
                <p className="loading-text">Loading chats...</p>
            </div>
        );
    }

    if (chats.length === 0) {
        return (
            <div className="nav-section">
                <p className="no-chats-text">No chats yet. Start a new conversation!</p>
            </div>
        );
    }

    return (
        <>
            <div className="nav-section">
                <h3 className="section-title">Recent Chats</h3>
                <ul>
                    {chats.map(chat => (
                        <li key={chat.id}>
                            <NavLink
                                to={`/c/${chat.id}`}
                                className={({ isActive }) => 
                                    `chat-link ${isActive ? 'active' : ''}`
                                }
                                title={chat.title}
                            >
                                {chat.title}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Test buttons */}
            <div style={{ padding: '10px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                <button
                    onClick={async () => {
                        try {
                            await chatService.createChat(
                                "Test Chat " + new Date().toLocaleTimeString(),
                                "This is a test message created at " + new Date().toLocaleTimeString()
                            );
                        } catch (error) {
                            console.error("Error creating test chat:", error);
                        }
                    }}
                    style={{
                        padding: '8px 12px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Add Test Chat
                </button>
                
                <button
                    onClick={async () => {
                        if (chats.length === 0) {
                            console.log("No chats to delete");
                            return;
                        }
                        
                        try {
                            const lastChat = chats[0];
                            await chatService.deleteChat(lastChat.id);
                        } catch (error) {
                            console.error("Error deleting chat:", error);
                        }
                    }}
                    style={{
                        padding: '8px 12px',
                        backgroundColor: '#f44336',
                        color: 'white', 
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Delete Last Chat
                </button>
            </div>
        </>
    );
};
