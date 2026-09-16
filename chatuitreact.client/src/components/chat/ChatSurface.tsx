import React, { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ChatHistory from './ChatHistory'
import ChatInput from './ChatInput'
import ConversationPanel from './ConversationPanel'
import NewChatWelcome from './NewChatWelcome'
import './ChatSurface.css'
import { setCurrentChatId, getChatNotFound } from '../../services/chatService'
import { conversationPanelOpenSignal } from '../../services/uiService'
import { useSignals } from '@preact/signals-react/runtime'
import { addNotification } from '../../services/notificationService'
import { useChatCache } from '../../hooks/useChatCache'
import useMediaQuery from '../../hooks/useMediaQuery'

interface ChatSurfaceProps {
  /** Hides the surface without unmounting it — see the note below. */
  hidden?: boolean
}

/**
 * The chat surface is mounted once by MainLayout and lives for the whole session.
 * It is deliberately NOT a route element: routing swaps route elements out, which
 * would unmount every opened chat. Navigating only ever changes what is visible
 * here — a chat is mounted when you open it and unmounted only when the LRU
 * evicts it.
 */
const ChatSurface: React.FC<ChatSurfaceProps> = ({ hidden = false }) => {
  useSignals()

  const location = useLocation()
  const navigate = useNavigate()

  // useParams is unavailable here: this renders inside the parent route element,
  // which cannot see child route params. Parse the path the way MainHeader does.
  const pathParts = location.pathname.split('/').filter(Boolean)
  const chatId = pathParts[0] === 'chat' && pathParts[1] && pathParts[1] !== 'new'
    ? pathParts[1]
    : undefined

  const notFound = chatId ? getChatNotFound(chatId) : undefined
  const cachedIds = useChatCache(chatId)
  const isWide = useMediaQuery('(min-width: 1100px)')

  useEffect(() => {
    setCurrentChatId(chatId)
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
    <div className="chat-surface" style={hidden ? { display: 'none' } : undefined}>
      <div className="chat-surface-body">
        <div className="chat-surface-main">
          {cachedIds.map((id) => (
            <div
              key={id}
              className="chat-surface-pane"
              style={{ display: id === chatId ? 'flex' : 'none' }}
            >
              <ChatHistory chatId={id} />
            </div>
          ))}
          <div
            className="chat-surface-pane"
            style={{ display: chatId === undefined ? 'flex' : 'none' }}
          >
            <NewChatWelcome />
          </div>
          <ChatInput />
        </div>
        {showPanel && <ConversationPanel chatId={chatId} />}
      </div>
    </div>
  )
}

export default ChatSurface
