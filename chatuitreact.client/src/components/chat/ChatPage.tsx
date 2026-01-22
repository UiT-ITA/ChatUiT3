import React, { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ChatHistory from './ChatHistory'
import ChatInput from './ChatInput'
import NewChatWelcome from './NewChatWelcome'
import './ChatPage.css'
import { clearSidebarContent, setChatSidebar } from '../../services/sidebarService'
import { setCurrentChatId, getChatNotFound } from '../../services/chatService'
import { useSignals } from '@preact/signals-react/runtime'
import { addNotification } from '../../services/notificationService'
import { useChatCache } from '../../hooks/useChatCache'

const ChatPage: React.FC = () => {
  useSignals()

  const { chatId } = useParams<{ chatId?: string }>()
  const navigate = useNavigate()
  const notFound = chatId ? getChatNotFound(chatId) : undefined
  const mountedChatsRef = useRef<Map<string, React.ReactElement>>(new Map())
  const cachedIds = useChatCache(chatId)

  const currentIds = new Set(cachedIds)
  const mountedIds = new Set(mountedChatsRef.current.keys())
  
  for (const id of mountedIds) {
    if (!currentIds.has(id)) {
      mountedChatsRef.current.delete(id)
    }
  }
  
  for (const id of currentIds) {
    if (!mountedChatsRef.current.has(id)) {
      mountedChatsRef.current.set(id, <ChatHistory key={id} chatId={id} />)
    }
  }

  useEffect(() => {
    setCurrentChatId(chatId)
    setChatSidebar()
    return () => {
      setCurrentChatId(undefined)
      clearSidebarContent()
    }
  }, [chatId])

  // Redirect to "/" when the requested chat does not exist (404 from API)
  useEffect(() => {
    if (chatId && notFound?.value) {
      addNotification({ level: 'Warning', message: 'Chat not found. Redirecting…' })
      navigate('/')
    }
  }, [chatId, notFound?.value, navigate])

  return (
    <div className="chat-page">
      {chatId === undefined ? (
        <NewChatWelcome />
      ) : (
        <>
          {Array.from(mountedChatsRef.current.entries()).map(([id, component]) => (
            <div
              key={id}
              style={{
                display: id === chatId ? 'flex' : 'none',
                flex: 1,
                flexDirection: 'column',
                minHeight: 0
              }}
            >
              {component}
            </div>
          ))}
        </>
      )}
      <ChatInput />
    </div>
  )
}

export default ChatPage
