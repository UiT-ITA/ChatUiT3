import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ChatHistory from './ChatHistory'
import ChatInput from './ChatInput'
import './ChatPage.css'
import { clearSidebarContent, setChatSidebar } from '../../services/sidebarService'
import { getCurrentChatId, setCurrentChatId } from '../../services/chatService'
import { useSignals } from '@preact/signals-react/runtime'
import LoadingIndicator from '../common/LoadingIndicator'

const ChatPage: React.FC = () => {
  useSignals()

  const { chatId } = useParams<{ chatId?: string }>()
  const currentChatId = getCurrentChatId()
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    // Show loading immediately when chatId changes
    if (chatId !== currentChatId.value) {
      setIsTransitioning(true)
    }
    
    setCurrentChatId(chatId)
    setChatSidebar()
    
    // Clear transition state after a brief delay to allow chat to load
    const timer = setTimeout(() => {
      setIsTransitioning(false)
    }, 100)

    return () => {
      clearTimeout(timer)
      setCurrentChatId(undefined)
      clearSidebarContent()
    }
  }, [chatId])

  return (
    <div className="chat-page">
      {isTransitioning ? (
        <div className="chat-page-loading">
          <LoadingIndicator text="Switching chat..." />
        </div>
      ) : currentChatId.value === undefined ? (
        <div style={{display: "flex", flexDirection: "column", height: "100%"}}> new chat </div>
      ) : (
        <ChatHistory />
      )}
      <ChatInput />
    </div>
  )
}

export default ChatPage
