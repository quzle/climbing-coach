import { useState, useEffect, useCallback } from 'react'

// =============================================================================
// TYPES
// =============================================================================

/**
 * A single message stored in the chat history. Matches the shape expected by
 * the /api/chat route's `history` field so messages can be sent directly as
 * context without transformation.
 */
export type StoredChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  context_snapshot: null
  created_at: string
  /** Active warnings from the AI, present on assistant messages only. */
  warnings?: string[]
}

// =============================================================================
// CONSTANTS
// =============================================================================

const HISTORY_KEY = 'climbing-coach:chat-history'

/**
 * Maximum number of messages retained in localStorage. When the limit is
 * reached, the oldest messages are dropped to keep storage usage bounded.
 */
const MAX_MESSAGES = 50

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/**
 * @description Reads and parses chat history from localStorage.
 * Returns an empty array if reading fails or storage is unavailable.
 *
 * @returns Array of stored messages, oldest first
 */
function loadHistory(): StoredChatMessage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw) as StoredChatMessage[]
  } catch {
    return []
  }
}

/**
 * @description Serialises the message array and writes it to localStorage.
 * Logs a warning if storage is unavailable or quota is exceeded — the
 * in-memory state remains intact so chat continues to function.
 *
 * @param messages The full message array to persist
 */
function saveHistory(messages: StoredChatMessage[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages))
  } catch (err) {
    console.warn('[useChatHistory] Failed to save history to localStorage:', err)
  }
}

/**
 * @description Removes the history entry from localStorage.
 * Errors are silently swallowed — if storage is inaccessible there
 * is nothing useful to do.
 */
function clearHistoryFromStorage(): void {
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    // Intentionally empty — storage may be locked in some security configs.
  }
}

// =============================================================================
// HOOK
// =============================================================================

export type UseChatHistoryReturn = {
  /** All stored messages in chronological order (oldest first). */
  messages: StoredChatMessage[]
  /**
   * Appends a new message to history. When the total exceeds MAX_MESSAGES,
   * the oldest messages are dropped. Persists to localStorage.
   */
  addMessage: (message: StoredChatMessage) => void
  /** Clears all messages from state and localStorage. */
  clearHistory: () => void
}

/**
 * @description Persists coach chat history to localStorage so previous
 * messages survive page reloads. Capped at 50 messages — when the limit
 * is reached, the oldest messages are dropped to keep storage bounded.
 *
 * History is loaded on mount; messages are written on every `addMessage`
 * call. The hook does not manage API calls — that is the page's responsibility.
 *
 * @returns Chat history state and helpers to add or clear messages.
 *
 * @example
 * const { messages, addMessage, clearHistory } = useChatHistory()
 *
 * // Append a user message
 * addMessage({ id: crypto.randomUUID(), role: 'user', content: text, ... })
 *
 * // Pass history to the API
 * fetch('/api/chat', { body: JSON.stringify({ message: text, history: messages }) })
 */
export function useChatHistory(): UseChatHistoryReturn {
  const [messages, setMessages] = useState<StoredChatMessage[]>([])

  // Load persisted history on mount only.
  useEffect(() => {
    setMessages(loadHistory())
  }, [])

  /**
   * @description Appends `message` to the history array and persists the
   * result. Drops the oldest messages if MAX_MESSAGES is exceeded.
   *
   * @param message The new message to append
   */
  const addMessage = useCallback((message: StoredChatMessage) => {
    setMessages((prev) => {
      const updated = [...prev, message]
      const capped =
        updated.length > MAX_MESSAGES ? updated.slice(updated.length - MAX_MESSAGES) : updated
      saveHistory(capped)
      return capped
    })
  }, [])

  /**
   * @description Removes all messages from state and localStorage.
   */
  const clearHistory = useCallback(() => {
    setMessages([])
    clearHistoryFromStorage()
  }, [])

  return { messages, addMessage, clearHistory }
}
