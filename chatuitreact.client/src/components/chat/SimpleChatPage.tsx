import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SimpleChatHistory from './SimpleChatHistory'
import ChatInput from './ChatInput'
import NewChatWelcome from './NewChatWelcome'
import './ChatPage.css'
import { clearSidebarContent, setChatSidebar } from '../../services/sidebarService'
import { getCurrentChatId, setCurrentChatId, getChatNotFound } from '../../services/chatService'
import { useSignals } from '@preact/signals-react/runtime'
import { addNotification } from '../../services/notificationService'

const SimpleChatPage: React.FC = () => {
  useSignals()

  const { chatId } = useParams<{ chatId?: string }>()
  const currentChatId = getCurrentChatId()
  const navigate = useNavigate()
  const notFound = chatId ? getChatNotFound(chatId) : undefined

  // Track all visited chat IDs to keep them mounted
  const [visitedChatIds, setVisitedChatIds] = useState<string[]>([])

  useEffect(() => {
    setCurrentChatId(chatId)
    setChatSidebar()
    return () => {
      setCurrentChatId(undefined)
      clearSidebarContent()
    }
  }, [chatId])

  // Add new chat IDs to the visited list
  useEffect(() => {
    if (chatId) {
      setVisitedChatIds(prev => 
        prev.includes(chatId) ? prev : [...prev, chatId]
      )
    }
  }, [chatId])

  // Redirect to "/" when the requested chat does not exist (404 from API)
  useEffect(() => {
    if (chatId && notFound?.value) {
      addNotification({ level: 'Warning', message: 'Chat not found. Redirecting…' })
      navigate('/')
    }
  }, [chatId, notFound?.value, navigate])

  const activeChatId = currentChatId.value

  return (
    <div className="chat-page">
      {activeChatId === undefined ? (
        <NewChatWelcome />
      ) : (
        // Render all visited chats, but only show the active one
        <>
          {visitedChatIds.map((id) => (
            <div
              key={id}
              style={{
                display: id === activeChatId ? 'flex' : 'none',
                flex: 1,
                flexDirection: 'column',
                minHeight: 0
              }}
            >
              <SimpleChatHistory chatId={id} />
            </div>
          ))}
        </>
      )}
      <ChatInput />
    </div>
  )
}

export default SimpleChatPage
