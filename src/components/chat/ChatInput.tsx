'use client'

import { useState, useRef, type KeyboardEvent } from 'react'
import { SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type ChatInputProps = {
  onSend: (text: string) => void
  disabled: boolean
  /** Pre-fills the input on first render (e.g. from a ?message= URL param). */
  initialValue?: string
}

/**
 * @description Text input area for the coach chat. Submits on Enter key
 * (Shift+Enter inserts a newline) or via the Send button. Clears after
 * each send.
 *
 * @param onSend       Called with the trimmed message text when the user submits
 * @param disabled     Disables input and button while an API call is in flight
 * @param initialValue Pre-fills the input on first render
 */
export function ChatInput({ onSend, disabled, initialValue = '' }: ChatInputProps): React.JSX.Element {
  const [value, setValue] = useState(initialValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSend(): void {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex items-end gap-2 border-t bg-white p-3">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask your coach…"
        disabled={disabled}
        rows={1}
        className="min-h-[44px] max-h-32 flex-1 resize-none"
      />
      <Button
        type="button"
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="min-h-[44px] min-w-[44px] shrink-0"
      >
        <SendHorizontal className="size-4" />
      </Button>
    </div>
  )
}
