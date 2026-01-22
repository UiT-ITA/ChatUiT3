import './ChatHistory.css'
import { getChat } from '../../services/chatService'
import { useSignals } from '@preact/signals-react/runtime'
import { useLayoutEffect, useRef, useEffect, useCallback, useDeferredValue, memo } from 'react'
import { useTranslation } from 'react-i18next'
import ChatMessage from './ChatMessage'
import LoadingIndicator from '../common/LoadingIndicator'

interface ChatHistoryProps {
  chatId: string
}

function ChatHistory({ chatId }: ChatHistoryProps) {
  useSignals()
  const { t } = useTranslation()

  const chat = getChat(chatId)
  const messages = chat.value?.messages || []

  const deferredMessages = useDeferredValue(messages)
  const isPending = deferredMessages !== messages

  const chatHistoryRef = useRef<HTMLDivElement>(null)
  const bottomSentinelRef = useRef<HTMLDivElement>(null)
  
  // Store pinned state in ref (no rerenders when user scrolls)
  const pinnedRef = useRef(true)

  const scrollToBottom = useCallback(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight
    }
  }, [])

  const scrollToBottomIfPinned = useCallback(() => {
    if (!pinnedRef.current) return
    const scroller = chatHistoryRef.current
    if (!scroller) return

    requestAnimationFrame(() => {
      if (!pinnedRef.current) return
      scroller.scrollTop = scroller.scrollHeight
    })
  }, [])

  // Scroll to bottom on mount
  useLayoutEffect(() => {
    scrollToBottom()
  }, [scrollToBottom])

  // IntersectionObserver to track if user is at bottom
  useEffect(() => {
    const scroller = chatHistoryRef.current
    const sentinel = bottomSentinelRef.current
    if (!scroller || !sentinel) return

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        pinnedRef.current = !!entry?.isIntersecting
      },
      {
        root: scroller,
        threshold: 0.01,
      }
    )

    io.observe(sentinel)
    return () => io.disconnect()
  }, [isPending, chatId])

  // Scroll event handler to track scroll position
  useEffect(() => {
    const scroller = chatHistoryRef.current
    if (!scroller) return

    const NEAR_BOTTOM_PX = 10

    const updatePinnedFromScrollPosition = () => {
      if (!scroller) return
      
      const distanceFromBottom =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
      pinnedRef.current = distanceFromBottom <= NEAR_BOTTOM_PX
    }

    scroller.addEventListener('scroll', updatePinnedFromScrollPosition, {
      passive: true,
    })
    
    return () => {
      scroller.removeEventListener('scroll', updatePinnedFromScrollPosition)
    }
  }, [isPending, chatId])

  // Always scroll to bottom when new message is added
  useLayoutEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  // Ensure scroll after deferred render
  useLayoutEffect(() => {
    scrollToBottom()
  }, [deferredMessages, scrollToBottom])

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
            onStreamingChunk={scrollToBottomIfPinned}
          />
        ))}
        {/* Bottom sentinel for IntersectionObserver */}
        <div ref={bottomSentinelRef} style={{ height: 1 }} />
      </div>
    </div>
  )
}

// Memoize to prevent re-renders when chatId doesn't change
export default memo(ChatHistory, (prev, next) =>
  prev.chatId === next.chatId
)
