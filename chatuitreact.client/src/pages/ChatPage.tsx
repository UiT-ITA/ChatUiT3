import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import ChatHistory from '../components/chat/ChatHistory';
import ChatInput from '../components/chat/ChatInput';
import NewChatWelcome from '../components/chat/NewChatWelcome';
import './ChatPage.css';
import chatService from '../services/chatService';
import { ContentType, Message, MessageChunkEvent, MessageChunkType, MessageRole } from '../types/chatModels';
import { getAssistantById } from '../services/mockAssistantService';
import { useAuth } from '../contexts/AuthContext';

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId: string }>();
  const [searchParams] = useSearchParams();
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(chatId);
  const [initialAssistantId, setInitialAssistantId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const streamingMessagesMap = useRef<Map<string, string>>(new Map());
  const previousChatId = useRef<string | undefined>(undefined);
  const auth = useAuth();

  // Set up message chunk handler for streaming responses
  useEffect(() => {
    const handleMessageChunk = (event: MessageChunkEvent) => {
      const { chatId: eventChatId, messageId, chunk, isComplete } = event;
      
      // Always process chunks to update the cache, even for non-active chats
      // But only update UI for current chat
      const isCurrentChat = currentChatId === eventChatId;
      
      // Get the current accumulated text or start with empty string
      const currentText = streamingMessagesMap.current.get(messageId) || '';
      const updatedText = currentText + chunk;
      
      streamingMessagesMap.current.set(messageId, updatedText);
      
      // Only update UI if this is for our current chat
      if (isCurrentChat) {
        // Update the message in our state
        setMessages(prevMessages => {
          const updatedMessages = [...prevMessages];
          const messageIndex = updatedMessages.findIndex(m => m.id === messageId);
          
          if (messageIndex >= 0) {
              // Update existing message
              updatedMessages[messageIndex] = {
                ...updatedMessages[messageIndex],
                chunks: [{ type: MessageChunkType.Text, content: updatedText }],
                isStreaming: !isComplete
              };
            } else {
              // Add new message if not found
              updatedMessages.push({
                id: messageId,
                chunks: [{ type: MessageChunkType.Text, content: updatedText }],
                sender: MessageRole.Assistant,
                timestamp: new Date(),
                contentType: ContentType.Text,
                isStreaming: !isComplete
              });
          }
          
          return updatedMessages;
        });
      }
      
      if (isComplete) {
        // Clean up the map when streaming is complete
        streamingMessagesMap.current.delete(messageId);
      }
    };
    
    // Register the handler and get the unsubscribe function
    const unsubscribe = chatService.onMessageChunkReceived(handleMessageChunk);
    
    // Clean up on unmount
    return () => {
      unsubscribe();
    };
  }, [currentChatId]);

  // Get access token when auth state changes
  useEffect(() => {
    const getToken = async () => {
      if (auth.isAuthenticated) {
        const token = await auth.getAccessToken();
        setAccessToken(token);
      } else {
        setAccessToken(null);
      }
    };
    
    getToken();
  }, [auth.isAuthenticated]);

  // Handle chat activity status changes
  useEffect(() => {
    // When a chat becomes inactive (we're navigating away from it)
    if (previousChatId.current && previousChatId.current !== chatId) {
      chatService.setActiveChatStatus(previousChatId.current, false);
    }
    
    // Save the current chat ID for the next status change
    previousChatId.current = chatId !== 'new' ? chatId : undefined;
    
    // Clean up on unmount - mark all as inactive
    return () => {
      if (previousChatId.current) {
        chatService.setActiveChatStatus(previousChatId.current, false);
      }
    };
  }, [chatId]);

  // Load chat on initial render or when chatId changes
  useEffect(() => {
    const loadChat = async () => {
      const queryParamQ = searchParams.get('q');
      const queryParamA = searchParams.get('a');
      let loadedMessages: Message[] = [];
      let activeChatId = chatId;
      setIsLoading(true);

      try {
        if (activeChatId && activeChatId !== 'new' && accessToken) {
          try {
            // Check if chat is already in the cache first
            const isCached = chatService.isChatCached(activeChatId);
            
            // Only fetch from server if not cached, otherwise just get from cache
            const existingChat = await chatService.getChatById(
              activeChatId, 
              accessToken,
              !isCached // force refresh only if not cached
            );
            if (existingChat) {
              loadedMessages = existingChat.messages;
              setCurrentChatId(existingChat.id);
              if (existingChat.assistantId) {
                setInitialAssistantId(existingChat.assistantId);
              }
              // Mark this chat as active
              chatService.setActiveChatStatus(existingChat.id, true);
            } else {
              console.warn(`Chat with ID "${activeChatId}" not found. Redirecting to new chat.`);
              // Explicitly redirect to the new chat page
              navigate('/c/new', { replace: true });
              setIsLoading(false); // Make sure to reset loading state
              return; // Exit early to prevent further processing
            }
          } catch (error) {
            console.error("Error fetching chat:", error);
            // Also handle API errors by redirecting to new chat
            navigate('/c/new', { replace: true });
            setIsLoading(false);
            return;
          }
        }
        
        if (!activeChatId || activeChatId === 'new') { // Handles /c/new or if chatId was not found
          setCurrentChatId(undefined); // Explicitly mark as no active existing chat
          if (queryParamQ) {
            const userMessage: Message = {
              id: Date.now().toString(),
              chunks: [{ type: MessageChunkType.Text, content: queryParamQ }],
              sender: MessageRole.User,
              timestamp: new Date(),
              contentType: ContentType.Text
            };
            loadedMessages.push(userMessage);
            // If provided with a query, create a new chat and send the message
            if (accessToken) {
              try {
                const chatTitle = queryParamQ.substring(0, 30) + (queryParamQ.length > 30 ? "..." : "");
                const newChat = await chatService.createChat(chatTitle, accessToken, queryParamA || undefined);
                if (newChat) {
                  setCurrentChatId(newChat.id);
                  // Mark this new chat as active
                  chatService.setActiveChatStatus(newChat.id, true);
                  await chatService.sendMessage(newChat.id, queryParamQ, accessToken, true);
                }
              } catch (err) {
                console.error("Error creating chat from query param:", err);
              }
            }
          }
          if (queryParamA && getAssistantById(queryParamA)) {
            setInitialAssistantId(queryParamA);
          }
        }
        
        setMessages(loadedMessages);
      } catch (error) {
        console.error("Error loading chat:", error);
        // Redirect to new chat page on critical errors too
        navigate('/c/new', { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    if (accessToken) {
      loadChat();
    }
  }, [chatId, searchParams, accessToken, navigate]);

  // Register for new message notifications
  useEffect(() => {
    if (!currentChatId) return;
    
    const handleNewMessage = (msgChatId: string, message: Message) => {
      // Only update UI for current chat
      if (msgChatId === currentChatId) {
        setMessages(prev => {
          // Check if we already have this message
          const exists = prev.some(m => m.id === message.id);
          if (exists) return prev;
          return [...prev, message];
        });
      }
    };
    
    const unsubscribe = chatService.onMessageReceived(handleNewMessage);
    
    return () => {
      unsubscribe();
    };
  }, [currentChatId]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !accessToken || isLoading) return;

    setIsLoading(true);

    try {
      // Only add the user message locally if we're creating a new chat
      // For existing chats, we'll receive messages via SignalR
      let userMessage: Message | null = null;
      
      // Create a proper user message object with chunks
      userMessage = {
        id: Date.now().toString(),
        chunks: [{ type: MessageChunkType.Text, content: text }],
        sender: MessageRole.User,
        timestamp: new Date(),
        contentType: ContentType.Text
      };
      
      // If this is the first message in a new chat
      if (!currentChatId) {
        const newChatTitle = text.substring(0, 30) + (text.length > 30 ? "..." : "");
        
        // Show the message immediately for better UX
        setMessages([userMessage]);
        
        try {
          // Create chat with the initial message included 
          const newChat = await chatService.createChat(
            newChatTitle, 
            text,
            accessToken, 
            initialAssistantId
          );
          
          if (newChat) {
            setCurrentChatId(newChat.id);
            
            // Mark this chat as active
            chatService.setActiveChatStatus(newChat.id, true);
            
            // Update URL without full page reload
            navigate(`/c/${newChat.id}`, { replace: true });
          } else {
            throw new Error("Failed to create chat");
          }
        } catch (chatError) {
          console.error("Error creating chat with first message:", chatError);
          throw chatError; // Re-throw to be caught by outer catch
        }
      } else {
        // For existing chats, don't add local messages, just show loading state
        // The message will come through SignalR
        await chatService.sendStreamingMessage(currentChatId, text, accessToken);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Show error to user
      setMessages(prevMessages => [
        ...prevMessages, 
        {
          id: 'error-' + Date.now(),
          chunks: [{ type: MessageChunkType.Text, content: "Sorry, there was an error sending your message. Please try again." }],
          sender: MessageRole.System,
          timestamp: new Date(),
          contentType: ContentType.Text
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [currentChatId, initialAssistantId, isLoading, navigate, accessToken]);

  // Handle assistant selection from the welcome screen
  const handleSelectAssistant = useCallback((assistantId: string) => {
    setInitialAssistantId(assistantId);
  }, []);

  const isNewChat = messages.length === 0;

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
