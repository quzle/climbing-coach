import React from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@/lib/test-utils'
import { ChatInput } from './ChatInput'

// =============================================================================
// TESTS
// =============================================================================

describe('ChatInput', () => {
  it('renders a textarea and send button', () => {
    render(<ChatInput onSend={jest.fn()} disabled={false} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
  })

  it('pre-fills the textarea with initialValue', () => {
    render(<ChatInput onSend={jest.fn()} disabled={false} initialValue="Pre-filled text" />)
    expect(screen.getByRole('textbox')).toHaveValue('Pre-filled text')
  })

  it('calls onSend with trimmed text when Send button is clicked', async () => {
    const onSend = jest.fn()
    const user = userEvent.setup()

    render(<ChatInput onSend={onSend} disabled={false} />)
    await user.type(screen.getByRole('textbox'), '  Hello coach  ')
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(onSend).toHaveBeenCalledWith('Hello coach')
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('calls onSend when Enter is pressed', async () => {
    const onSend = jest.fn()
    const user = userEvent.setup()

    render(<ChatInput onSend={onSend} disabled={false} />)
    await user.type(screen.getByRole('textbox'), 'Hello')
    await user.keyboard('{Enter}')

    expect(onSend).toHaveBeenCalledWith('Hello')
  })

  it('does not call onSend when Shift+Enter is pressed', async () => {
    const onSend = jest.fn()
    const user = userEvent.setup()

    render(<ChatInput onSend={onSend} disabled={false} />)
    await user.type(screen.getByRole('textbox'), 'Hello')
    await user.keyboard('{Shift>}{Enter}{/Shift}')

    expect(onSend).not.toHaveBeenCalled()
  })

  it('clears the textarea after sending', async () => {
    const user = userEvent.setup()

    render(<ChatInput onSend={jest.fn()} disabled={false} />)
    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Hello')
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(textarea).toHaveValue('')
  })

  it('does not call onSend when input is empty or whitespace-only', async () => {
    const onSend = jest.fn()
    const user = userEvent.setup()

    render(<ChatInput onSend={onSend} disabled={false} />)
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(onSend).not.toHaveBeenCalled()
  })

  it('disables textarea and send button when disabled=true', () => {
    render(<ChatInput onSend={jest.fn()} disabled={true} />)
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
  })

  it('disables the send button when textarea is empty', () => {
    render(<ChatInput onSend={jest.fn()} disabled={false} />)
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
  })
})
