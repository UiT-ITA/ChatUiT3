import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useChatList } from '../../services/chatListService';
import { chatListService } from '../../services/chatListService';
import './Sidebar.css';

const Sidebar: React.FC = () => {
    const chats = useChatList();

    useEffect(() => {
        // Initialize chat service when sidebar loads
        chatListService.initialize();

        // Clean up when unmounting
        return () => {
            chatListService.dispose();
        };
    }, []);

    return (
        <aside className="sidebar">
            <nav>
                <div className="main-nav">
                    <ul>
                        <li><NavLink to="/dashboard">Dashboard</NavLink></li>
                        <li><NavLink to="/weather">Weather</NavLink></li>
                        <li><NavLink to="/test">Test</NavLink></li>
                        <li><NavLink to="/profile">Profile</NavLink></li>
                    </ul>
                </div>

                <div className="chats-nav">
                    <h3>Your Chats</h3>
                    {chats.length === 0 ? (
                        <p className="no-chats">No chats yet</p>
                    ) : (
                        <ul className="chats-list">
                            {chats.map(chat => (
                                <li key={chat.id}>
                                    <NavLink to={`/chat/${chat.id}`} className={({ isActive }) => isActive ? 'active' : ''}>
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
            </nav>
        </aside>
    );
};

export default Sidebar;