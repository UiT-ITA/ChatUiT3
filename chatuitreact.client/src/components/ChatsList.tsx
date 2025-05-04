import React from 'react';
import { NavLink } from 'react-router-dom';
import { useChatList } from '../services/chatListService';
import './ChatsList.css';

export const ChatsList: React.FC = () => {
    const chats = useChatList();

    return (
        <div className="chats-list-container">
            <h2>Your Chats</h2>
            {chats.length === 0 ? (
                <p className="no-chats-message">No chats found. Create a new one to get started.</p>
            ) : (
                <ul className="chats-list">
                    {chats.map(chat => (
                        <li key={chat.id} className="chat-item">
                            <NavLink to={`/chat/${chat.id}`} className="chat-link">
                                <h3 className="chat-name">{chat.name}</h3>
                                <p className="chat-assistant">Assistant: {chat.assistantName}</p>
                                <p className="chat-updated">Last updated: {new Date(chat.updatedAt).toLocaleString()}</p>
                                {chat.lastMessagePreview && (
                                    <p className="chat-preview">{chat.lastMessagePreview}</p>
                                )}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            )}
            <div className="new-chat-container">
                <NavLink to="/chat/new" className="new-chat-button">Create New Chat</NavLink>
            </div>
        </div>
    );
};

export default ChatsList;