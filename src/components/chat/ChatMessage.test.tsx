import React from 'react'
import { render, screen } from '@/lib/test-utils'
import { ChatMessage } from './ChatMessage'
import type { StoredChatMessage } from '@/hooks/useChatHistory'

// =============================================================================
// HELPERS
// =============================================================================

function makeMessage(overrides: Partial<StoredChatMessage> = {}): StoredChatMessage {
  return {
    id: 'test-id',
    role: 'user',
    content: 'Hello',
    context_snapshot: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('ChatMessage', () => {
  it('renders the message content', () => {
    render(<ChatMessage message={makeMessage({ content: 'Test message content' })} />)
    expect(screen.getByText('Test message content')).toBeInTheDocument()
  })

  it('aligns user messages to the right', () => {
    const { container } = render(<ChatMessage message={makeMessage({ role: 'user' })} />)
    expect(container.firstChild).toHaveClass('justify-end')
  })

  it('aligns assistant messages to the left', () => {
    const { container } = render(
      <ChatMessage message={makeMessage({ role: 'assistant', content: 'Coach reply' })} />,
    )
    expect(container.firstChild).toHaveClass('justify-start')
  })

  it('applies blue background to user message bubbles', () => {
    render(<ChatMessage message={makeMessage({ role: 'user', content: 'User msg' })} />)
    const bubble = screen.getByText('User msg').closest('div')
    expect(bubble).toHaveClass('bg-blue-600')
  })

  it('applies slate background to assistant message bubbles', () => {
    render(<ChatMessage message={makeMessage({ role: 'assistant', content: 'Coach msg' })} />)
    const bubble = screen.getByText('Coach msg').closest('div')
    expect(bubble).toHaveClass('bg-slate-100')
  })

  it('renders multiline content preserving whitespace', () => {
    const { container } = render(
      <ChatMessage message={makeMessage({ content: 'Line one\nLine two' })} />,
    )
    // RTL normalises whitespace in text queries; query the p element directly
    const p = container.querySelector('p')
    expect(p).toHaveClass('whitespace-pre-wrap')
  })
})
