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

/**
 * @description Returns the localStorage key for the given user (and optional
 * thread). Scoped per user — and per thread when provided — to prevent history
 * leakage when multiple accounts or conversations share a browser.
 *
 * @param userId The authenticated user's UUID
 * @param threadId Optional chat-thread UUID for per-thread isolation
 * @returns The localStorage key string
 */
function historyKey(userId: string, threadId: string | null): string {
  return threadId
    ? `climbing-coach:chat-history:${userId}:${threadId}`
    : `climbing-coach:chat-history:${userId}`
}

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
 * @param key The user-scoped localStorage key
 * @returns Array of stored messages, oldest first
 */
function loadHistory(key: string): StoredChatMessage[] {
  try {
    const raw = localStorage.getItem(key)
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
 * @param key The user-scoped localStorage key
 * @param messages The full message array to persist
 */
function saveHistory(key: string, messages: StoredChatMessage[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(messages))
  } catch (err) {
    console.warn('[useChatHistory] Failed to save history to localStorage:', err)
  }
}

/**
 * @description Removes the history entry from localStorage.
 * Errors are silently swallowed — if storage is inaccessible there
 * is nothing useful to do.
 *
 * @param key The user-scoped localStorage key
 */
function clearHistoryFromStorage(key: string): void {
  try {
    localStorage.removeItem(key)
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
 * @param userId The authenticated user's UUID — used to scope the localStorage key
 * @param threadId Optional chat-thread UUID for per-thread key isolation
 * @returns Chat history state and helpers to add or clear messages.
 *
 * @example
 * const { messages, addMessage, clearHistory } = useChatHistory(userId)
 *
 * // Append a user message
 * addMessage({ id: crypto.randomUUID(), role: 'user', content: text, ... })
 *
 * // Pass history to the API
 * fetch('/api/chat', { body: JSON.stringify({ message: text, history: messages }) })
 */
export function useChatHistory(userId: string, threadId: string | null = null): UseChatHistoryReturn {
  const key = historyKey(userId, threadId)
  const [messages, setMessages] = useState<StoredChatMessage[]>([])

  // Load persisted history on mount only.
  useEffect(() => {
    setMessages(loadHistory(key))
  }, [key])

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
      saveHistory(key, capped)
      return capped
    })
  }, [key])

  /**
   * @description Removes all messages from state and localStorage.
   */
  const clearHistory = useCallback(() => {
    setMessages([])
    clearHistoryFromStorage(key)
  }, [key])

  return { messages, addMessage, clearHistory }
}
