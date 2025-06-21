import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ChatHistory from '../components/chat/ChatHistory';
import ChatInput from '../components/chat/ChatInput';
import NewChatWelcome from '../components/chat/NewChatWelcome';
import { useSignalR } from '../contexts/SignalRContext';
import { useSendMessage } from '../hooks/useChats';
import { useCurrentAssistant } from '../contexts/ChatDataProvider';
import { ChatFile } from '../types/chatModels';
import './ChatPage.css';

const ChatPage = () => {
    const { t } = useTranslation('chat');
    const { chatId } = useParams<{ chatId: string }>();
    const { loadChat, isConnected, onChatCreated } = useSignalR();
    const sendMessageMutation = useSendMessage();
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
                onSuccess: (response) => {
                    if (targetChatId === 'new' && response.chatId) {
                        // Navigate to the new chat
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
