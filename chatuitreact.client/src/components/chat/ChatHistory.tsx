import './ChatHistory.css'
import { getChat, getSelectableAssistants } from '../../services/chatService'
import { useSignals } from '@preact/signals-react/runtime'
import { useLayoutEffect, useRef, useEffect, useCallback, memo } from 'react'
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
  const assistants = getSelectableAssistants().value || []
  // Only a fallback: messages carry their own assistant. Used for any message whose
  // assistant snapshot is empty.
  const fallbackAssistantName = assistants.find((a) => a.id === chat.value?.assistantId)?.name

  const chatHistoryRef = useRef<HTMLDivElement>(null)
  const bottomSentinelRef = useRef<HTMLDivElement>(null)
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
  }, [messages])


  useLayoutEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  if (chat.value === undefined) {
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
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            chatId={chatId}
            message={message}
            fallbackAssistantName={fallbackAssistantName}
            onStreamingChunk={scrollToBottomIfPinned}
          />
        ))}
        {/* Bottom sentinel for IntersectionObserver */}
        <div ref={bottomSentinelRef} style={{ height: 1 }} />
      </div>
    </div>
  )
}

export default memo(ChatHistory, (prev, next) => prev.chatId === next.chatId)
