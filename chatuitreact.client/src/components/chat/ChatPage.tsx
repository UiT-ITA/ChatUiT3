import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import ChatHistory from './ChatHistory'
import ChatInput from './ChatInput'
import './ChatPage.css'
import { clearSidebarContent, setChatSidebar } from '../../services/sidebarService'
import { getCurrentChatId, setCurrentChatId } from '../../services/chatService'
import { useSignals } from '@preact/signals-react/runtime'

const ChatPage: React.FC = () => {
  useSignals()

  const { chatId } = useParams<{ chatId?: string }>()
  const currentChatId = getCurrentChatId()

  useEffect(() => {
    setCurrentChatId(chatId)
    setChatSidebar()
    return () => {
      setCurrentChatId(undefined)
      clearSidebarContent()
    }
  }, [chatId])

  return (
    <div className="chat-page">

    { currentChatId.value === undefined ? (
        <div style={{display: "flex", flexDirection: "column", height: "100%"}}> new chat </div>
    ):(
      <ChatHistory />
    )
    
  }
      <ChatInput />
    </div>
  )
}

export default ChatPage
