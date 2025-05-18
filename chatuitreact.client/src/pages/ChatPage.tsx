import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import ChatHistory from '../components/chat/ChatHistory';
import ChatInput from '../components/chat/ChatInput';
import NewChatWelcome from '../components/chat/NewChatWelcome';
import './ChatPage.css';
//import { type Message, getChatById, addMessageToChat, createNewChatEntry } from '../services/chatService';
import { getAssistantById } from '../services/mockAssistantService';

const ChatPage = () => {
    //const [messages, setMessages] = useState<Message[]>([]);
    const navigate = useNavigate();
    const { chatId } = useParams<{ chatId: string }>();
    const [searchParams] = useSearchParams();
    const [currentChatId, setCurrentChatId] = useState<string | undefined>(chatId);
    const [initialAssistantId, setInitialAssistantId] = useState<string | undefined>();

    //useEffect(() => {
    //    const queryParamQ = searchParams.get('q');
    //    const queryParamA = searchParams.get('a');
    //    //let loadedMessages: Message[] = [];
    //    let activeChatId = chatId;

    //    if (activeChatId && activeChatId !== 'new') {
    //        const existingChat = getChatById(activeChatId);
    //        if (existingChat) {
    //            loadedMessages = existingChat.messages;
    //            setCurrentChatId(existingChat.id); // Ensure currentChatId is set
    //            if (existingChat.assistantId) {
    //                setInitialAssistantId(existingChat.assistantId);
    //                console.log(`Loaded chat ${existingChat.id} with assistant: ${existingChat.assistantId}`);
    //            }
    //        } else {
    //            console.warn(`Chat with ID "${activeChatId}" not found. Starting a new chat.`);
    //            activeChatId = undefined; // Treat as new chat
    //            setCurrentChatId(undefined);
    //        }
    //    }

    //    if (!activeChatId || activeChatId === 'new') { // Handles /c/new or if chatId was not found
    //        setCurrentChatId(undefined); // Explicitly mark as no active existing chat
    //        if (queryParamQ) {
    //            const userMessage: Message = {
    //                id: Date.now().toString(),
    //                text: queryParamQ,
    //                sender: 'user',
    //                timestamp: new Date(),
    //            };
    //            loadedMessages.push(userMessage);
    //            // Optionally, add a mock assistant response
    //            const assistantMessage: Message = {
    //                id: (Date.now() + 1).toString(),
    //                text: `Assistant responding to: "${queryParamQ}"`,
    //                sender: 'assistant',
    //                timestamp: new Date(Date.now() + 1000),
    //            };
    //            loadedMessages.push(assistantMessage);
    //        }
    //        if (queryParamA && getAssistantById(queryParamA)) {
    //            setInitialAssistantId(queryParamA);
    //            console.log(`New chat started with preferred assistant: ${queryParamA}`);
    //        } else {
    //            console.log('Started a new chat session.');
    //        }
    //    }
    //    setMessages(loadedMessages);
    //}, [chatId, searchParams]);

    const handleSendMessage = (text: string) => {
        //if (!text.trim()) return;

        //const newMessage: Message = {
        //    id: Date.now().toString(),
        //    text,
        //    sender: 'user',
        //    timestamp: new Date(),
        //};

        //setMessages(prevMessages => [...prevMessages, newMessage]);

        //// If this is the first message in a new chat, create an entry in mockChatService
        //// and navigate to its new URL.
        //if (!currentChatId) {
        //    const newChatId = `guid-${Date.now()}`;
        //    const newChatTitle = text.substring(0, 30) + (text.length > 30 ? "..." : "");
        //    createNewChatEntry(newChatId, newChatTitle, [newMessage], searchParams.get('a') || undefined);
        //    setCurrentChatId(newChatId);
        //    // Update URL without full page reload, and ensure sidebar can update
        //    // We also need to trigger a re-render or state update in Sidebar if it's not already observing changes.
        //    // For now, direct navigation will update the URL, and ChatPage will re-evaluate.
        //    // A more robust solution might involve a shared state/context for chat list.
        //    navigate(`/c/${newChatId}`, { replace: true });
        //} else {
        //    addMessageToChat(currentChatId, newMessage);
        //}

        //// Mock assistant reply
        //setTimeout(() => {
        //    const assistantReply: Message = {
        //        id: (Date.now() + 1).toString(),
        //        text: `Assistant: I received "${text}".`,
        //        sender: 'assistant',
        //        timestamp: new Date(),
        //    };
        //    setMessages(prevMessages => [...prevMessages, assistantReply]);
        //    if (currentChatId) { // currentChatId should be set if we are in an existing chat or just created one
        //        addMessageToChat(currentChatId, assistantReply);
        //    }
        //}, 1000);
    };

    // Handle assistant selection from the welcome screen
    const handleSelectAssistant = (assistantId: string) => {
        setInitialAssistantId(assistantId);
    };

    //const isNewChat = messages.length === 0;

    return (
        <div className="chat-page">
            {/*{isNewChat ? (*/}
                <NewChatWelcome
                    initialAssistantId={initialAssistantId}
                    onSelectAssistant={handleSelectAssistant}
                />
            {/*) : (*/}
                {/*<ChatHistory messages={messages} />*/}
            {/*)}*/}
            <ChatInput
                onSendMessage={handleSendMessage}
                initialAssistantId={initialAssistantId}
            />
        </div>
    );
};

export default ChatPage;
