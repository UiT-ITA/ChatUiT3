import { getChat, getSelectableAssistants } from '../../services/chatService'
import { useSignals } from '@preact/signals-react/runtime'
import { useLayoutEffect, useState, memo } from 'react'
import { createScrollAreaController, ScrollArea, ScrollAreaContent, ScrollAreaViewport } from '@ui-sdk/react/scroll-area'
import { useTranslation } from 'react-i18next'
import ChatMessage from './ChatMessage'
import LoadingIndicator from '../common/LoadingIndicator'
import Stack from '../common/Stack'
import { cx } from '../common/layout'
import { scrollFadeClass } from '../common/scrollFade'
import './MessageFeed.css'

const NO_MESSAGES: never[] = []

/** The scrolling column of a chat's messages, which follows new content while the view is at the bottom. */
function ChatHistory({ chatId }: { chatId: string }) {
  useSignals()
  const { t } = useTranslation()

  const chat = getChat(chatId)
  const loaded = chat.value !== undefined
  const messages = chat.value?.messages ?? NO_MESSAGES
  // The chat's assistant name, for messages without an assistant name of their own
  const fallbackAssistantName = (getSelectableAssistants().value || []).find((a) => a.id === chat.value?.assistantId)?.name

  const [scroll] = useState(createScrollAreaController)

  // A new message always brings the view to the bottom
  useLayoutEffect(() => {
    scroll.scrollToEnd()
  }, [messages.length, scroll])

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
    <ScrollArea stickToEnd controller={scroll} className="message-feed__area">
      <ScrollAreaViewport className={cx('message-feed', scrollFadeClass('y', 'medium'))}>
        <ScrollAreaContent className="message-feed__messages">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              chatId={chatId}
              message={message}
              fallbackAssistantName={fallbackAssistantName}
            />
          ))}
          <div className="message-feed__end" />
        </ScrollAreaContent>
      </ScrollAreaViewport>
    </ScrollArea>
  )
}

export default memo(ChatHistory)
