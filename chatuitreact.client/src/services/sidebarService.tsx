import { signal } from '@preact/signals-react';
import type { ReactNode } from 'react';
import { ChatList } from '../components/chat/ChatList';
// import DocList from '../components/doc/DocList';
// import { AssistantList } from '../components/assistants/AssistantList';

export const sidebarContentSignal = signal<ReactNode | null>(null);

export function setSidebarContent(content: ReactNode | null) {
  sidebarContentSignal.value = content;
}

export function setChatSidebar() {
  setSidebarContent(<ChatList />);
}

// export function setDocSidebar() {
//   setSidebarContent(<DocList />);
// }

// export function setAssistantSidebar() {
//   setSidebarContent(<AssistantList />);
// }

export function clearSidebarContent() {
  setSidebarContent(null);
}
