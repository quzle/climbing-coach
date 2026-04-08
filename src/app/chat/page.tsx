'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { WarningBanner } from '@/components/ui/WarningBanner'
import { Skeleton } from '@/components/ui/skeleton'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatInput } from '@/components/chat/ChatInput'
import { ResetChatDialog } from '@/components/chat/ResetChatDialog'
import { useChatHistory, type StoredChatMessage } from '@/hooks/useChatHistory'
import { useAuth } from '@/hooks/useAuth'
import type { ApiResponse } from '@/types'

// =============================================================================
// INNER COMPONENT
// Separated so useSearchParams is contained within a Suspense boundary.
// =============================================================================

function ChatContent(): React.JSX.Element {
  const searchParams = useSearchParams()
  const initialValue = searchParams.get('message') ?? ''
  const { user } = useAuth()

  const { messages, addMessage, clearHistory } = useChatHistory(user?.id ?? '')
  const [isLoading, setIsLoading] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  function handleResetChat(): void {
    clearHistory()
    setWarnings([])
  }

  // Scroll to the latest message whenever messages update or loading starts.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  async function handleSend(text: string): Promise<void> {
    const userMessage: StoredChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      context_snapshot: null,
      created_at: new Date().toISOString(),
    }

    // Add user message to local history before the API call so it appears
    // immediately. `messages` still holds the pre-send state in this closure.
    addMessage(userMessage)
    setIsLoading(true)

    try {
      // Send pre-send history as context; the current message travels in `message`.
      const historyPayload = messages.map(({ id, role, content, context_snapshot, created_at }) => ({
        id,
        role,
        content,
        context_snapshot,
        created_at,
      }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: historyPayload }),
      })

      const json = (await res.json()) as ApiResponse<{ response: string; warnings: string[] }>

      if (!res.ok || json.error) {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: json.error ?? 'The coach is temporarily unavailable. Please try again.',
          context_snapshot: null,
          created_at: new Date().toISOString(),
        })
        return
      }

      const { response, warnings: newWarnings } = json.data!

      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        context_snapshot: null,
        created_at: new Date().toISOString(),
        warnings: newWarnings.length > 0 ? newWarnings : undefined,
      })

      if (newWarnings.length > 0) {
        setWarnings(newWarnings)
      }
    } catch {
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'The coach is temporarily unavailable. Please try again.',
        context_snapshot: null,
        created_at: new Date().toISOString(),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-slate-900">Coach Chat</h1>
          <ResetChatDialog onConfirmReset={handleResetChat} />
        </div>
      </div>

      {/* Warnings banner */}
      {warnings.length > 0 && (
        <div className="px-4 pt-3 shrink-0">
          <WarningBanner warnings={warnings} onDismiss={() => setWarnings([])} />
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-16">
            <p className="text-3xl mb-3">👋</p>
            <p className="text-sm font-medium text-slate-600">Ask your coach anything</p>
            <p className="text-xs mt-1">Training advice, session planning, injury questions</p>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3 space-y-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0">
        <ChatInput onSend={handleSend} disabled={isLoading} initialValue={initialValue} />
      </div>
    </div>
  )
}

// =============================================================================
// PAGE
// Outer Suspense boundary required by Next.js for useSearchParams in a
// Client Component.
// =============================================================================

export default function ChatPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col h-full">
          <div className="border-b px-4 py-3">
            <Skeleton className="h-6 w-28" />
          </div>
          <div className="flex-1 px-4 py-4 space-y-3">
            <Skeleton className="h-12 w-3/4 ml-auto rounded-2xl" />
            <Skeleton className="h-16 w-3/4 rounded-2xl" />
          </div>
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  )
}
