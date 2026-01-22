import './ChatHistory.css'
import { getChat } from '../../services/chatService'
import { useSignals } from '@preact/signals-react/runtime'
import { useLayoutEffect, useRef, useEffect, useCallback, useDeferredValue, memo } from 'react'
import { useTranslation } from 'react-i18next'
import ChatMessage from './ChatMessage'
import LoadingIndicator from '../common/LoadingIndicator'

interface SimpleChatHistoryProps {
  chatId: string
}

function SimpleChatHistory({ chatId }: SimpleChatHistoryProps) {
  useSignals()
  const { t } = useTranslation()

  const chat = getChat(chatId)
  const messages = chat.value?.messages || []

  const deferredMessages = useDeferredValue(messages)
  const isPending = deferredMessages !== messages

  const chatHistoryRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)
  const prevScrollTopRef = useRef(0)
  const rafIdRef = useRef<number | null>(null)

  const scrollToBottom = () => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight
    }
  }

  const evaluateAutoScroll = () => {
    if (!chatHistoryRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = chatHistoryRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    const scrollDirection = scrollTop > prevScrollTopRef.current ? 'down' : 'up'

    if (scrollDirection === 'up' && distanceFromBottom > 0) {
      autoScrollRef.current = false
    } else if (scrollDirection === 'down' && distanceFromBottom < 100) {
      autoScrollRef.current = true
    }

    prevScrollTopRef.current = scrollTop
  }

  const handleScroll = () => {
    if (rafIdRef.current != null) return
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      evaluateAutoScroll()
    })
  }

  const scrollToBottomIfShouldAutoScroll = useCallback(() => {
    if (!chatHistoryRef.current || !autoScrollRef.current) return
    requestAnimationFrame(() => {
      if (chatHistoryRef.current && autoScrollRef.current) {
        chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight
      }
    })
  }, [])

  // Attach scroll event listener
  useEffect(() => {
    const chatContainer = chatHistoryRef.current
    if (!chatContainer) return

    chatContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => chatContainer.removeEventListener('scroll', handleScroll)
  }, [])

  // Handle new messages - always scroll to bottom and enable auto-scroll
  useLayoutEffect(() => {
    if (autoScrollRef.current) {
      scrollToBottom()
    }
  }, [messages])

  // Ensure scroll after deferred render
  useLayoutEffect(() => {
    requestAnimationFrame(scrollToBottom)
  }, [deferredMessages])

  if (chat.value === undefined || isPending) {
    return (
      <div className="chat-history">
        <div className="chat-history-loading">
          <LoadingIndicator text={t('chat.loadingChat')} />
        </div>
      </div>
    )
  }

  return (
    <div className="chat-history" ref={chatHistoryRef}>
      <div className="chat-history-messages">
        {deferredMessages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onStreamingChunk={scrollToBottomIfShouldAutoScroll}
          />
        ))}
      </div>
    </div>
  )
}

// Memoize to prevent re-renders when chatId doesn't change
export default memo(SimpleChatHistory, (prev, next) =>
  prev.chatId === next.chatId
)
