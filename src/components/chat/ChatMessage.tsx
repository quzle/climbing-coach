'use client'
import type { StoredChatMessage } from '@/hooks/useChatHistory'
import { ProseMarkdown } from '@/components/ui/prose-markdown'

type ChatMessageProps = {
  message: StoredChatMessage
}

/**
 * @description Renders a single chat message bubble. User messages appear
 * right-aligned on a blue background; assistant messages appear left-aligned
 * on a muted slate background.
 *
 * @param message The message to render
 */
export function ChatMessage({ message }: ChatMessageProps): React.JSX.Element {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-slate-100 text-slate-900 rounded-bl-sm'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <ProseMarkdown>{message.content}</ProseMarkdown>
        )}
      </div>
    </div>
  )
}
