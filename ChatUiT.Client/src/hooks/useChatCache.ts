import { useEffect } from 'react'
import { signal } from '@preact/signals-react'

const cachedChatIds = signal<string[]>([])
const MAX_CACHE = 5

/** The ids with the given chat moved to the end, keeping the last MAX_CACHE. */
const touch = (ids: string[], chatId: string | undefined) =>
  chatId ? [...ids.filter(id => id !== chatId), chatId].slice(-MAX_CACHE) : ids

/** The chats kept mounted: the most recently opened ones, the current chat last. */
export function useChatCache(currentChatId: string | undefined): string[] {
  useEffect(() => {
    if (currentChatId) cachedChatIds.value = touch(cachedChatIds.peek(), currentChatId)
  }, [currentChatId])

  return touch(cachedChatIds.peek(), currentChatId)
}

export function removeCachedChat(chatId: string) {
  cachedChatIds.value = cachedChatIds.peek().filter(id => id !== chatId)
}
