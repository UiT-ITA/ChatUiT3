import { getChat, getSelectableAssistants } from '../../services/chatService'
import { useSignals } from '@preact/signals-react/runtime'
import { useLayoutEffect, useRef, useEffect, useCallback, memo } from 'react'
import { useTranslation } from 'react-i18next'
import ChatMessage from './ChatMessage'
import LoadingIndicator from '../common/LoadingIndicator'
import Stack from '../common/Stack'
import { cx } from '../common/layout'
import { scrollFadeClass } from '../common/scrollFade'
import './MessageFeed.css'

const NO_MESSAGES: never[] = []

/** The scrolling column of a chat's messages, which stays at the bottom while the view is at the bottom. */
function ChatHistory({ chatId }: { chatId: string }) {
  useSignals()
  const { t } = useTranslation()

  const chat = getChat(chatId)
  const loaded = chat.value !== undefined
  const messages = chat.value?.messages ?? NO_MESSAGES
  // The chat's assistant name, for messages without an assistant name of their own
  const fallbackAssistantName = (getSelectableAssistants().value || []).find((a) => a.id === chat.value?.assistantId)?.name

  const scrollerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)

  const scrollToBottom = useCallback(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
  }, [])

  // The view is at the bottom while the sentinel after the last message is in view
  useEffect(() => {
    const scroller = scrollerRef.current
    const sentinel = sentinelRef.current
    if (!scroller || !sentinel) return
    const io = new IntersectionObserver((entries) => {
      pinnedRef.current = !!entries[0]?.isIntersecting
    }, { root: scroller, threshold: 0.01 })
    io.observe(sentinel)
    return () => io.disconnect()
  }, [loaded])

  useLayoutEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  // Keeps the view at the bottom while the messages change size and the view is at the bottom
  const contentRef = useCallback((content: HTMLDivElement | null) => {
    if (!content) return
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) scrollToBottom()
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [scrollToBottom])

  if (!loaded) {
    return (
      <div className="message-feed">
        <Stack align="center" justify="center" height="full" minHeight="2xs">
          <LoadingIndicator text={t('chat.loadingChat')} />
        </Stack>
      </div>
    )
  }

  return (
    <div className={cx('message-feed', scrollFadeClass('y', 'medium'))} ref={scrollerRef}>
      <div className="message-feed__messages" ref={contentRef}>
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            chatId={chatId}
            message={message}
            fallbackAssistantName={fallbackAssistantName}
          />
        ))}
        <div ref={sentinelRef} className="message-feed__sentinel" />
      </div>
    </div>
  )
}

export default memo(ChatHistory, (prev, next) => prev.chatId === next.chatId)
