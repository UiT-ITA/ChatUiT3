import React, { useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useChatList, chatListService } from '../../services/chatListService';
import './MainLayout.css';

const MainLayout: React.FC = () => {
    const { isAuthenticated, isInitializing, login, logout } = useAuth();
    const chats = useChatList();

    // Initialize chat service when component mounts (only for authenticated users)
    useEffect(() => {
        if (isAuthenticated) {
            chatListService.initialize();
        }

        return () => {
            chatListService.dispose();
        };
    }, [isAuthenticated]);

    return (
        <div className="layout-container">
            {/* App Bar - always visible */}
            <header className="app-bar">
                <h1>My Application</h1>
                <div className="nav-links">
                    <Link to="/">Home</Link>
                    <Link to="/weather">Weather</Link>
                    <Link to="/test">Test</Link>
                    {isAuthenticated ? (
                        <button onClick={logout} className="logout-button">Sign Out</button>
                    ) : (
                        <button onClick={login} className="login-button">Sign In</button>
                    )}
                </div>
            </header>

            <div className="content-wrapper">
                {/* Sidebar - always visible */}
                <aside className="sidebar">
                    <nav>
                        <ul className="main-nav">
                            <li><Link to="/">Home</Link></li>
                            <li><Link to="/weather">Weather</Link></li>
                            <li><Link to="/test">Test</Link></li>
                            <li><Link to="/profile">Profile</Link></li>
                        </ul>

                        {/* Chat List Section - only visible when authenticated */}
                        {isAuthenticated && (
                            <div className="chats-nav">
                                <h3>Your Chats</h3>
                                {chats.length === 0 ? (
                                    <p className="no-chats">No chats yet</p>
                                ) : (
                                    <ul className="chats-list">
                                        {chats.map(chat => (
                                            <li key={chat.id}>
                                                <NavLink to={`/chat/${chat.id}`}>
                                                    <span className="chat-name">{chat.name}</span>
                                                    <span className="chat-assistant">{chat.assistantName}</span>
                                                </NavLink>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <div className="new-chat">
                                    <NavLink to="/chat/new" className="new-chat-button">
                                        + New Chat
                                    </NavLink>
                                </div>
                            </div>
                        )}
                    </nav>
                </aside>

                {/* Main Content Area - ALWAYS renders the Outlet */}
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;