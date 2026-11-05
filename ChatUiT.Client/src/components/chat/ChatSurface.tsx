import React, { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ChatHistory from './ChatHistory'
import ChatInput from './ChatInput'
import ConversationPanel from './ConversationPanel'
import NewChatWelcome from './NewChatWelcome'
import Stack from '../common/Stack'
import { setCurrentChatId, getChatNotFound } from '../../services/chatService'
import { conversationPanelOpenSignal } from '../../services/uiService'
import { useSignals } from '@preact/signals-react/runtime'
import { addNotification } from '../../services/notificationService'
import { useChatCache } from '../../hooks/useChatCache'
import useMediaQuery from '../../hooks/useMediaQuery'
import { WIDE } from '../common/breakpoints';
import { parseRoute } from '../../utils/routes';

// A column that fills the remaining space of its parent and clips its content
const PANE = { gap: 'none', expand: true, minHeight: '0', overflow: 'hidden' } as const

/**
 * The chat area: the opened chats, the new chat welcome, the composer and the conversation panel.
 * MainLayout renders it for every route, hidden outside the chat routes. Each opened chat stays mounted,
 * hidden while another chat is shown, until the chat cache evicts it.
 */
const ChatSurface: React.FC<{ hidden?: boolean }> = ({ hidden = false }) => {
  useSignals()
  const { t } = useTranslation()

  const navigate = useNavigate()
  const { chatId } = parseRoute(useLocation().pathname)

  const notFound = chatId ? getChatNotFound(chatId) : undefined
  const cachedIds = useChatCache(chatId)
  const isWide = useMediaQuery(WIDE)

  useEffect(() => {
    setCurrentChatId(chatId)
  }, [chatId])

  // Goes to "/" when the requested chat does not exist
  useEffect(() => {
    if (chatId && notFound?.value) {
      addNotification({ level: 'Warning', message: t('chat.chatNotFound') })
      navigate('/')
    }
  }, [chatId, notFound?.value, navigate, t])

  const showPanel = chatId !== undefined && conversationPanelOpenSignal.value && isWide

  return (
    <Stack direction="row" gap="none" height="full" width="full" overflow="hidden" hidden={hidden}>
      <Stack {...PANE}>
        {[...cachedIds].sort().map((id) => (
          <Stack key={id} {...PANE} hidden={id !== chatId}>
            <ChatHistory chatId={id} />
          </Stack>
        ))}
        <Stack {...PANE} hidden={chatId !== undefined}>
          <NewChatWelcome />
        </Stack>
        <ChatInput />
      </Stack>
      {showPanel && <ConversationPanel chatId={chatId} />}
    </Stack>
  )
}

export default ChatSurface
