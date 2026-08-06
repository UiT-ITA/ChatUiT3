import { useEffect } from 'react'
import { signal } from '@preact/signals-react'

const cachedChatIds = signal<string[]>([])
const MAX_CACHE = 5

export function useChatCache(currentChatId: string | undefined): string[] {
  useEffect(() => {
    if (!currentChatId) return

    const current = cachedChatIds.peek()
    const filtered = current.filter(id => id !== currentChatId)
    const updated = [...filtered, currentChatId]
    
    if (updated.length > MAX_CACHE) {
      updated.shift()
    }
    
    cachedChatIds.value = updated
  }, [currentChatId])

  const current = cachedChatIds.peek()
  if (!currentChatId) return current
  
  const currentSet = new Set(current)
  if (currentSet.has(currentChatId)) {
    // LRU: Move to end
    const filtered = current.filter(id => id !== currentChatId)
    return [...filtered, currentChatId]
  }
  
  const updated = [...current, currentChatId]
  if (updated.length > MAX_CACHE) {
    updated.shift()
  }
  return updated
}

export function removeCachedChat(chatId: string) {
  cachedChatIds.value = cachedChatIds.peek().filter(id => id !== chatId)
}

export function clearChatCache() {
  cachedChatIds.value = []
}
