import React, { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useParams, useNavigate } from 'react-router-dom';
import ChatInput from './ChatInput';
import NewChatWelcome from './NewChatWelcome';
import './ChatPage.css';
import { clearSidebarContent, setChatSidebar } from '../../services/sidebarService';
import { getCurrentChatId, setCurrentChatId, getChatNotFound } from '../../services/chatService';
import { useSignals } from '@preact/signals-react/runtime';
import { addNotification } from '../../services/notificationService';
import NewChatHistory from './NewChatHistory';
import { SettingsProvider } from '../../contexts/SettingsContext';

const activeContainerStyle = { display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 } as const;
const hiddenContainerStyle = { display: 'none', flex: 1, flexDirection: 'column', minHeight: 0 } as const;

function ensureChatContainer(host: HTMLDivElement, chatId: string, rootMap: Map<string, Root>): void {
  if (rootMap.has(chatId)) return;

  const container = document.createElement('div');
  container.dataset.chatId = chatId;
  container.style.display = 'none';
  container.style.setProperty('flex', '1');
  container.style.setProperty('flex-direction', 'column');
  container.style.setProperty('min-height', '0');

  host.appendChild(container);

  const root = createRoot(container);
  root.render(
    <SettingsProvider>
      <NewChatHistory chatId={chatId} />
    </SettingsProvider>
  );
  rootMap.set(chatId, root);
}

function updateContainerVisibility(host: HTMLDivElement, activeChatId?: string): void {
  Array.from(host.children).forEach((child) => {
    const element = child as HTMLDivElement;
    const id = element.dataset.chatId;
    const isActive = id && id === activeChatId;
    element.style.display = isActive ? 'flex' : 'none';
    element.style.setProperty('flex', '1');
    element.style.setProperty('flex-direction', 'column');
    element.style.setProperty('min-height', '0');
  });
}

const NewChatPage: React.FC = () => {
  useSignals();

  const { chatId } = useParams<{ chatId?: string }>();
  const currentChatId = getCurrentChatId();
  const navigate = useNavigate();
  const notFound = chatId ? getChatNotFound(chatId) : undefined;

  const [visitedChatIds, setVisitedChatIds] = useState<string[]>([]);
  const hostRef = useRef<HTMLDivElement>(null);
  const rootMapRef = useRef<Map<string, Root>>(new Map());

  useEffect(() => {
    setCurrentChatId(chatId);
    setChatSidebar();
    return () => {
      setCurrentChatId(undefined);
      clearSidebarContent();
    };
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    setVisitedChatIds((prev) => (prev.includes(chatId) ? prev : [...prev, chatId]));
  }, [chatId]);

  useEffect(() => {
    if (chatId && notFound?.value) {
      addNotification({ level: 'Warning', message: 'Chat not found. Redirecting…' });
      navigate('/');
    }
  }, [chatId, notFound?.value, navigate]);

  const activeChatId = currentChatId.value;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    visitedChatIds.forEach((id) => ensureChatContainer(host, id, rootMapRef.current));
    updateContainerVisibility(host, activeChatId);
  }, [visitedChatIds, activeChatId]);

  useEffect(() => {
    return () => {
      rootMapRef.current.forEach((root) => root.unmount());
      rootMapRef.current.clear();
      if (hostRef.current) {
        hostRef.current.innerHTML = '';
      }
    };
  }, []);

  const hostStyle = activeChatId === undefined ? hiddenContainerStyle : activeContainerStyle;

  return (
    <div className="chat-page">
      {activeChatId === undefined ? <NewChatWelcome /> : null}
      <div ref={hostRef} style={hostStyle} />
      <ChatInput />
    </div>
  );
};

export default NewChatPage;
