import React, { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ChatHistory from './ChatHistory'
import ChatInput from './ChatInput'
import ConversationPanel from './ConversationPanel'
import NewChatWelcome from './NewChatWelcome'
import './ChatPage.css'
import { setCurrentChatId, getChatNotFound } from '../../services/chatService'
import { conversationPanelOpenSignal } from '../../services/uiService'
import { useSignals } from '@preact/signals-react/runtime'
import { addNotification } from '../../services/notificationService'
import { useChatCache } from '../../hooks/useChatCache'
import useMediaQuery from '../../hooks/useMediaQuery'

const ChatPage: React.FC = () => {
  useSignals()

  const { chatId } = useParams<{ chatId?: string }>()
  const navigate = useNavigate()
  const notFound = chatId ? getChatNotFound(chatId) : undefined
  const mountedChatsRef = useRef<Map<string, React.ReactElement>>(new Map())
  const cachedIds = useChatCache(chatId)
  const isWide = useMediaQuery('(min-width: 1100px)')

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
    return () => {
      setCurrentChatId(undefined)
    }
  }, [chatId])

  // Redirect to "/" when the requested chat does not exist (404 from API)
  useEffect(() => {
    if (chatId && notFound?.value) {
      addNotification({ level: 'Warning', message: 'Chat not found. Redirecting…' })
      navigate('/')
    }
  }, [chatId, notFound?.value, navigate])

  const showPanel = chatId !== undefined && conversationPanelOpenSignal.value && isWide

  return (
    <div className="chat-page">
      <div className="chat-page-body">
        <div className="chat-page-main">
          {chatId === undefined ? (
            <NewChatWelcome />
          ) : (
            <>
              {Array.from(mountedChatsRef.current.entries()).map(([id, component]) => (
                <div
                  key={id}
                  className="chat-page-history"
                  style={{ display: id === chatId ? 'flex' : 'none' }}
                >
                  {component}
                </div>
              ))}
            </>
          )}
          <ChatInput />
        </div>
        {showPanel && <ConversationPanel chatId={chatId} />}
      </div>
    </div>
  )
}

export default ChatPage
