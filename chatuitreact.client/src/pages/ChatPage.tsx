import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ChatHistory from '../components/chat/ChatHistory';
import ChatInput from '../components/chat/ChatInput';
import NewChatWelcome from '../components/chat/NewChatWelcome';
import { useSendMessage } from '../hooks/useChats';
import { useCurrentAssistant, useChatData } from '../contexts/ChatDataProvider';
import { ChatFile } from '../types/chatModels';
import './ChatPage.css';

const ChatPage = () => {
    const { t } = useTranslation('chat');
    const { chatId } = useParams<{ chatId: string }>();
    const sendMessageMutation = useSendMessage();
    const { setCurrentChatId } = useChatData();
    const navigate = useNavigate();

    // Set current chat ID when chat changes
    useEffect(() => {
        if (chatId && chatId !== 'new' && chatId !== '404') {
            setCurrentChatId(chatId);
        } else {
            setCurrentChatId(null);
        }
    }, [chatId, setCurrentChatId]);

    const handleSendMessage = (text: string, files?: ChatFile[], assistantId?: string) => {
        if (!text.trim()) return;
        
        const targetChatId = (!chatId || chatId === 'new' || chatId === '404') ? 'new' : chatId;
        
        sendMessageMutation.mutate(
            { 
                chatId: targetChatId, 
                content: text, 
                files, 
                assistantId 
            },
            {
                onSuccess: (response: any) => {
                    if (targetChatId === 'new' && response.chatId) {
                        navigate(`/c/${response.chatId}`);
                    }
                },
                onError: (error) => {
                    console.error('Error sending message:', error);
                }
            }
        );
    };

    const { setCurrentAssistantId } = useCurrentAssistant();
    
    const handleSelectAssistant = (assistantId: string) => {
        setCurrentAssistantId(assistantId);
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
                        onSelectAssistant={handleSelectAssistant}
                    />
                </>
            ) : (
                <ChatHistory />
            )}
            <ChatInput
                onSendMessage={handleSendMessage}
                chatId={chatId}
            />
        </div>
    );
};

export default ChatPage;
