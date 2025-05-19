import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ChatHistory from '../components/chat/ChatHistory';
import ChatInput from '../components/chat/ChatInput';
import NewChatWelcome from '../components/chat/NewChatWelcome';
import { useSignalR } from '../contexts/SignalRContext';
import './ChatPage.css';

const ChatPage = () => {
    const { chatId } = useParams<{ chatId: string }>();
    const { messages, loadChat, sendMessage, isConnected } = useSignalR();
    const [initialAssistantId, setInitialAssistantId] = useState<string | undefined>();

    useEffect(() => {
        if (chatId && chatId !== 'new' && isConnected) {
            loadChat(chatId);
        }
    }, [chatId, loadChat, isConnected]);

    const handleSendMessage = (text: string) => {
        if (!text.trim() || !chatId) return;
        sendMessage(chatId, text);
    };

    // Handle assistant selection from the welcome screen
    const handleSelectAssistant = (assistantId: string) => {
        setInitialAssistantId(assistantId);
    };

    const isNewChat = !chatId || chatId === 'new' || messages.length === 0;

    return (
        <div className="chat-page">
            {isNewChat ? (
                <NewChatWelcome
                    initialAssistantId={initialAssistantId}
                    onSelectAssistant={handleSelectAssistant}
                />
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
