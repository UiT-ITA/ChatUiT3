import './Sidebar.css';
import SidebarButton from './SidebarButton';
import { useEffect, useState, useRef } from 'react';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PiSidebarSimple } from "react-icons/pi";
import { RiSettings3Line, RiChatAiLine, RiChatSettingsLine, RiAdminLine, RiUserLine } from 'react-icons/ri';
import { GrHelpBook } from "react-icons/gr";
import { TbMessageCircleSearch } from "react-icons/tb";
import { MdOutlineVpnKey } from "react-icons/md";

import { useAuth } from '../../contexts/AuthContext';
import chatService from '../../services/chatService'; // Import the real chat service
import { ChatListItem, ChatUpdateStatus } from '../../types/chatModels';


interface SidebarProps {
    onToggleSidebar: () => void;
    // onNewChat is handled by NavLink to /c/new now
    isNarrow: boolean;
    className?: string;
}

const Sidebar = ({ onToggleSidebar, isNarrow, className }: SidebarProps) => {
    const [chatHistory, setChatHistory] = useState<ChatListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [chatUpdateStatus, setChatUpdateStatus] = useState<Map<string, ChatUpdateStatus>>(new Map());
    const location = useLocation();
    const navigate = useNavigate();
    const { chatId } = useParams<{ chatId?: string }>();

    const { isAdmin, isAuthenticated, login, logout, getAccessToken } = useAuth();

    // Handle responsive sidebar
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 768 && !isNarrow) {
                onToggleSidebar();
            } else if (window.innerWidth > 768 && isNarrow) {
                onToggleSidebar();
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isNarrow, onToggleSidebar]);

    // Use ref outside the effect hook, at the top level
    const requestCounter = useRef(0);
    
    // Single unified useEffect to handle chat loading and refreshing
    useEffect(() => {
        // Flag to prevent duplicate API calls
        let isLoading = false;
        
        const loadOrRefreshChats = async () => {
            // Skip if we're already loading or not authenticated
            if (isLoading || !isAuthenticated) {
                if (!isAuthenticated) {
                    setChatHistory([]);
                    setLoading(false);
                }
                return;
            }
            
            isLoading = true;
            setLoading(true);
            
            // Create a unique request ID to avoid race conditions
            const currentRequest = ++requestCounter.current;
            
            try {
                const tokenResponse = await getAccessToken();
                const token = tokenResponse || undefined;
                
                // Never start with an empty list if we already have data
                // This prevents the blinking effect
                const isInitialLoad = chatHistory.length === 0;
                const isComingToRootPath = location.pathname === '/';
                
                if (isInitialLoad) {
                    // For initial load, use direct API call
                    setLoading(true); // Only show loading on initial load
                    const chats = await chatService.getChats(token);
                    
                    // Only update state if this is still the most recent request
                    if (currentRequest === requestCounter.current) {
                        setChatHistory(chats);
                    }
                } else {
                    // For subsequent refreshes, check if we need to refresh
                    // But don't clear the existing chat list
                    const MAX_CACHE_AGE = 10 * 60 * 1000; // 10 minutes
                    const needsRefresh = chatService.isChatListRefreshNeeded(MAX_CACHE_AGE);
                    const forceRefresh = isComingToRootPath;
                    
                    if (needsRefresh || forceRefresh) {
                        // No setLoading here to avoid flicker
                        await chatService.refreshChatList(token, forceRefresh);
                        // ChatService will call the onChatListUpdated handler 
                        // which updates the state without clearing it first
                    }
                }
            } catch (error) {
                console.error("Failed to load/refresh chats:", error);
            } finally {
                // Only update loading state if this is still the most recent request
                if (currentRequest === requestCounter.current) {
                    setLoading(false);
                }
                isLoading = false;
            }
        };
        
        // Call the function immediately
        loadOrRefreshChats();
        
        // Subscribe to chat list updates
        const unsubscribeList = chatService.onChatListUpdated((chats) => {
            setChatHistory(chats);
        });
        
        // Subscribe to chat update status changes
        const unsubscribeStatus = chatService.onChatUpdateStatus((chatId, status) => {
            setChatUpdateStatus(prev => {
                const newMap = new Map(prev);
                newMap.set(chatId, status);
                return newMap;
            });
        });
        
        // Cleanup subscriptions on unmount
        return () => {
            unsubscribeList();
            unsubscribeStatus();
        };
    }, [isAuthenticated, getAccessToken, login]);

    return (
        <div className={`sidebar ${isNarrow ? 'narrow' : 'wide'} ${className || ''}`}>
            <div className="sidebar-top">
                <button className="icon-button sidebar-toggle" onClick={onToggleSidebar} title={isNarrow ? 'Expand sidebar' : 'Collapse sidebar'}>
                    <PiSidebarSimple size={"24px"} />
                </button>
                <div className="sidebar-spacer" />
                <button className="icon-button" onClick={() => console.log('Search clicked')} title="Search">
                    <TbMessageCircleSearch size={"24px"} />
                </button>
                {/* "New Chat" button now uses NavLink */}
                <NavLink to="/c/new" className="icon-button" title="New chat">
                    <RiChatAiLine size={"24px"} />
                </NavLink>
            </div>

            <div className="sidebar-divider" />

            <div className="sidebar-content">
                <nav className="sidebar-nav">
                    {!isAuthenticated ? (
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
                    ) : loading ? (
                        <div className="nav-section">
                            <p className="loading-text">Loading chats...</p>
                        </div>
                    ) : chatHistory.length > 0 ? (
                        <div className="nav-section">
                            <h3 className="section-title">Recent Chats</h3>
                            <ul>
                                {chatHistory.map(chat => {
                                    const isCurrentChat = chatId === chat.id;
                                    const isUpdating = chat.isUpdating || chatUpdateStatus.get(chat.id) === 'updating';
                                    
                                    // Only show updating indicator for non-current chats
                                    const showUpdateIndicator = isUpdating && !isCurrentChat;
                                    
                                    return (
                                        <li key={chat.id}>
                                            <NavLink
                                                to={`/c/${chat.id}`}
                                                className={({ isActive }) => 
                                                    `chat-link ${isActive ? 'active' : ''} ${showUpdateIndicator ? 'updating' : ''}`
                                                }
                                                title={chat.title}
                                            >
                                                {showUpdateIndicator && (
                                                    <span className="update-indicator" aria-label="Chat is being updated"></span>
                                                )}
                                                {isNarrow ? chat.title.substring(0, 1).toUpperCase() : chat.title}
                                            </NavLink>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ) : (
                        <div className="nav-section">
                            <p className="no-chats-text">No chats yet. Start a new conversation!</p>
                        </div>
                    )}
                    {/* You can add more sections like "Yesterday", "Previous 7 Days" etc. later if needed */}
                </nav>
            </div>

            <div className="sidebar-divider" />
            
            {/* Test buttons for adding/deleting chats */}
            {isAuthenticated && (
                <div style={{ padding: '10px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <button
                        onClick={async () => {
                            try {
                                const tokenResponse = await getAccessToken();
                                const token = tokenResponse || undefined;
                                
                                // Create a predefined test chat
                                const result = await chatService.createChat(
                                    "Test Chat " + new Date().toLocaleTimeString(),
                                    token
                                );
                                
                                if (result) {
                                    console.log("Created test chat:", result.id);
                                }
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
                            if (chatHistory.length === 0) {
                                console.log("No chats to delete");
                                return;
                            }
                            
                            try {
                                const tokenResponse = await getAccessToken();
                                const token = tokenResponse || undefined;
                                
                                // Delete the most recently added chat
                                const lastChat = chatHistory[0];
                                const success = await chatService.deleteChat(lastChat.id, token);
                                
                                if (success) {
                                    console.log("Deleted chat:", lastChat.id);
                                }
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
            )}
            
            <div className="sidebar-divider" />
            <div className="sidebar-bottom"> {/* Bottom section for the settings button */}
                {/* Help button (redirect to user manual) */}
                <SidebarButton
                    icon={<GrHelpBook size={24} />}
                    text="Help"
                    onClick={() => navigate('/help')}
                    isNarrow={isNarrow}
                />

                {/* Settings for the current chat */}
                <SidebarButton
                    icon={<RiChatSettingsLine size={24} />}
                    text="Chat Settings"
                    onClick={() => console.log('Chat settings clicked')}
                    isNarrow={isNarrow}
                />

                {/* Settings for the app */}
                <SidebarButton
                    icon={<RiSettings3Line size={24} />}
                    text="Settings"
                    onClick={() => console.log('Settings clicked')}
                    isNarrow={isNarrow}
                />

                {/* Admin settings - Only show if userIsAdmin is true*/}
                {isAdmin && (
                    <SidebarButton
                        icon={<RiAdminLine size={24} />}
                        text="Admin"
                        onClick={() => navigate('/admin')}
                        isNarrow={isNarrow}
                    />
                )}

                {/* Account login/logout */}
                <SidebarButton
                    icon={<RiUserLine size={24} />}
                    text="Account"
                    onClick={() => navigate('/profile')}
                    isNarrow={isNarrow}
                />

                {isAuthenticated ? (
                    <SidebarButton
                        icon={<MdOutlineVpnKey size={24} />}
                        text="Log out"
                        onClick={logout}
                        isNarrow={isNarrow}
                    />
                ) : (
                    <SidebarButton
                        icon={<MdOutlineVpnKey size={24} />}
                        text="Log in"
                        onClick={login}
                        isNarrow={isNarrow}
                    />
                )}
            </div>
        </div>
    );
};

export default Sidebar;
