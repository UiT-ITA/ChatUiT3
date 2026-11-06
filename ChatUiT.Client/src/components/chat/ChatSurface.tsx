import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ChatHistory from './ChatHistory'
import ChatInput from './ChatInput'
import ConversationPanel from './ConversationPanel'
import NewChatWelcome from './NewChatWelcome'
import Stack from '../common/Stack'
import { setCurrentChatId, getChatNotFound } from '../../services/chatService'
import { conversationPanelOpenSignal, filledCodeBlockSignal } from '../../services/uiService'
import { useSignals } from '@preact/signals-react/runtime'
import { addNotification } from '../../services/notificationService'
import { useChatCache } from '../../hooks/useChatCache'
import useMediaQuery from '../../hooks/useMediaQuery'
import { WIDE } from '../common/breakpoints';
import { parseRoute } from '../../utils/routes';
import { FillLayerContext } from './codeBlockFill';
import './ChatSurface.css';

// A column that fills the remaining space of its parent and clips its content
const PANE = { gap: 'none', expand: true, minHeight: '0', overflow: 'hidden' } as const

/**
 * The chat area: the opened chats, the new chat welcome, the composer and the conversation panel, and the layer
 * that shows a code block in full view over all of them.
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

  const [fillLayer, setFillLayer] = useState<HTMLDivElement | null>(null)

  // Leaves full view when another chat opens or the chat area is hidden
  useEffect(() => {
    filledCodeBlockSignal.value = null
  }, [chatId, hidden])

  // Goes to "/" when the requested chat does not exist
  useEffect(() => {
    if (chatId && notFound?.value) {
      addNotification({ level: 'Warning', message: t('chat.chatNotFound') })
      navigate('/')
    }
  }, [chatId, notFound?.value, navigate, t])

  const showPanel = chatId !== undefined && conversationPanelOpenSignal.value && isWide
  // While a code block is in full view, the content under the fill layer takes no focus or input
  const filled = filledCodeBlockSignal.value !== null

  return (
    <FillLayerContext.Provider value={fillLayer}>
      <Stack direction="row" gap="none" height="full" width="full" overflow="hidden" position="relative" hidden={hidden} className="chat-surface">
        <Stack {...PANE} inert={filled}>
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
        {showPanel && (
          <Stack direction="row" gap="none" grow={false} shrink={false} inert={filled}>
            <ConversationPanel chatId={chatId} />
          </Stack>
        )}
        <div ref={setFillLayer} className="chat-fill-layer" hidden={!filled} />
      </Stack>
    </FillLayerContext.Provider>
  )
}

export default ChatSurface
