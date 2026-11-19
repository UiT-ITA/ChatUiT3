import React, { useEffect, useRef, useState } from 'react'
import { createResizableController, Resizable, ResizableHandle, ResizablePanel } from '@ui-sdk/react/resizable'
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
import { ErrorCode, formatError } from '../../errors/errorCodes'
import { useChatCache } from '../../hooks/useChatCache'
import useMediaQuery from '../../hooks/useMediaQuery'
import { WIDE } from '../common/breakpoints';
import { parseRoute } from '../../utils/routes';
import { sizeToken } from '../../utils/cssTokens';
import { layoutStorage } from '../../utils/layoutStorage';
import './ChatSurface.css';

// A column that fills the remaining space of its parent and clips its content
const PANE = { gap: 'none', expand: true, minHeight: '0', overflow: 'hidden' } as const

const OVERVIEW_PANEL = 'conversation-panel'

/**
 * The chat area: the opened chats, the new chat welcome and the composer, and the conversation panel beside them.
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
      addNotification({ level: 'Warning', message: formatError(t('chat.chatNotFound'), ErrorCode.ChatNotFound) })
      navigate('/')
    }
  }, [chatId, notFound?.value, navigate, t])

  // The conversation overview is a resizable panel: open from the header toggle on a wide screen with a chat open
  const showPanel = chatId !== undefined && conversationPanelOpenSignal.value && isWide
  const [panel] = useState(createResizableController)
  const panelOpen = useRef(showPanel)
  // Saves the layout only while the panel is open, so the saved width is the open width
  const [storage] = useState(() => layoutStorage(() => !panel.isCollapsed(OVERVIEW_PANEL)))
  // The panel's sizes, read from their tokens once
  const [sizes] = useState(() => ({ default: sizeToken('--size-xs'), max: sizeToken('--size-md') }))

  useEffect(() => {
    panelOpen.current = showPanel
    if (showPanel) panel.expand(OVERVIEW_PANEL)
    else panel.collapse(OVERVIEW_PANEL)
  }, [showPanel, panel])

  return (
    <Stack gap="none" height="full" width="full" overflow="hidden" hidden={hidden}>
      <Resizable
        controller={panel}
        autoSaveId="conversation-panel"
        storage={storage}
        className="chat-surface"
        // Dragging the panel closed, or Enter on its edge, closes it as the header toggle does
        onLayoutChange={() => { if (panelOpen.current && panel.isCollapsed(OVERVIEW_PANEL)) conversationPanelOpenSignal.value = false }}
      >
        <ResizablePanel id="chat-pane" className="chat-surface__pane">
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
        </ResizablePanel>
        <ResizableHandle aria-label={t('chat.panel.resize')} className="resize-handle" disabled={!showPanel} />
        <ResizablePanel id={OVERVIEW_PANEL} defaultSize={sizes.default} minSize={sizes.default} maxSize={sizes.max} collapsible className="chat-surface__pane">
          {showPanel && <ConversationPanel chatId={chatId} />}
        </ResizablePanel>
      </Resizable>
    </Stack>
  )
}

export default ChatSurface
