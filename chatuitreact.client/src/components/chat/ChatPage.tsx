import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
// import { useTranslation } from 'react-i18next'
import ChatHistory from './ChatHistory'
import ChatInput from './ChatInput'
import NewChatWelcome from './NewChatWelcome'
import './ChatPage.css'
import { clearSidebarContent, setChatSidebar } from '../../services/sidebarService'
import { getCurrentChatId, setCurrentChatId, getChatNotFound } from '../../services/chatService'
import { useSignals } from '@preact/signals-react/runtime'
// import LoadingIndicator from '../common/LoadingIndicator'
import { addNotification } from '../../services/notificationService'

const ChatPage: React.FC = () => {
  useSignals()
  // const { t } = useTranslation()

  const { chatId } = useParams<{ chatId?: string }>()
  const currentChatId = getCurrentChatId()
  const navigate = useNavigate()
  const notFound = chatId ? getChatNotFound(chatId) : undefined

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
      {currentChatId.value === undefined ? (
        <NewChatWelcome />
      ) : (
        <ChatHistory />
      )}
      <ChatInput />
    </div>
  )
}

export default ChatPage
