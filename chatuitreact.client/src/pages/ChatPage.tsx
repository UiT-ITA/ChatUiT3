import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChatHistory from '../components/chat/ChatHistory';
import ChatInput from '../components/chat/ChatInput';
import NewChatWelcome from '../components/chat/NewChatWelcome';
import { useSignalR } from '../contexts/SignalRContext';
import './ChatPage.css';

const ChatPage = () => {
    const { chatId } = useParams<{ chatId: string }>();
    const { chatList, loadChat, sendMessage, isConnected, onChatCreated } = useSignalR();
    const [initialAssistantId, setInitialAssistantId] = useState<string | undefined>();
    const navigate = useNavigate();

    // Get messages directly from cache based on URL chatId
    const messages = useMemo(() => {
        if (!chatId || chatId === 'new' || chatId === '404') return [];
        const currentChat = chatList.find(chat => chat.id === chatId);
        return currentChat?.messages || [];
    }, [chatList, chatId]);

    // Load chat data in background after UI has updated
    useEffect(() => {
        if (chatId && chatId !== 'new' && chatId !== '404' && isConnected) {
            loadChat(chatId, () => navigate('/c/404'));
        }
    }, [chatId, loadChat, isConnected, navigate]);

    useEffect(() => {
        onChatCreated((chatId: string) => {
            console.log("Navigating to new chat:", chatId);
            navigate(`/c/${chatId}`);
        });
    }, [navigate, onChatCreated]);

    const handleSendMessage = (text: string) => {
        if (!text.trim()) return;
        if (!chatId || chatId === 'new' || chatId === '404') {
            sendMessage('new', text);
        } else {
            sendMessage(chatId, text);
        }
    };

    const handleSelectAssistant = (assistantId: string) => {
        setInitialAssistantId(assistantId);
    };

    const isNewChat = !chatId || chatId === 'new' || chatId === '404';

    return (
        <div className="chat-page">
            {isNewChat ? (
                <>
                    {chatId === '404' && (
                        <div className="chat-error">
                            Chat not found. You can start a new chat below.
                        </div>
                    )}
                    <NewChatWelcome
                        initialAssistantId={initialAssistantId}
                        onSelectAssistant={handleSelectAssistant}
                    />
                </>
            ) : (
                <ChatHistory messages={messages} />
            )}
            <ChatInput
                onSendMessage={handleSendMessage}
                initialAssistantId={initialAssistantId}
            />
        </div>
    );
};

export default ChatPage;
