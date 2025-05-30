import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ChatHistory from '../components/chat/ChatHistory';
import ChatInput from '../components/chat/ChatInput';
import NewChatWelcome from '../components/chat/NewChatWelcome';
import { useSignalR } from '../contexts/SignalRContext';
// import { useActiveChat } from '../hooks/useChatData';
import { chatStore } from '../stores/ChatStore';
import './ChatPage.css';

const ChatPage = () => {
    const { t } = useTranslation('chat');
    const { chatId } = useParams<{ chatId: string }>();
    const { loadChat, sendMessage, streamMessage, isConnected, onChatCreated } = useSignalR();
    // const activeChat = useActiveChat();
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

    useEffect(() => {
        // Set up the streamMessage callback in the store
        chatStore.setStreamMessageCallback(streamMessage);
    }, [streamMessage]);

    const handleSendMessage = (text: string, assistantId?: string) => {
        if (!text.trim()) return;
        if (!chatId || chatId === 'new' || chatId === '404') {
            sendMessage('new', text, assistantId);
        } else {
            sendMessage(chatId, text, assistantId);
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
                            {t('chatNotFound')}
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
