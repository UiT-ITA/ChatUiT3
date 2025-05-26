import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChatHistory from '../components/chat/ChatHistory';
import ChatInput from '../components/chat/ChatInput';
import NewChatWelcome from '../components/chat/NewChatWelcome';
import { useSignalR } from '../contexts/SignalRContext';
import './ChatPage.css';

const ChatPage = () => {
    const { chatId } = useParams<{ chatId: string }>();
    const { loadChat, sendMessage, isConnected, onChatCreated } = useSignalR();
    const [initialAssistantId, setInitialAssistantId] = useState<string | undefined>();
    const navigate = useNavigate();

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
                <ChatHistory />
            )}
            <ChatInput
                onSendMessage={handleSendMessage}
                initialAssistantId={initialAssistantId}
            />
        </div>
    );
};

export default ChatPage;
