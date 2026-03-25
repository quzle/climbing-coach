import React from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/lib/test-utils'
import { ResetChatDialog } from './ResetChatDialog'

describe('ResetChatDialog', () => {
  it('renders reset button', () => {
    render(<ResetChatDialog onConfirmReset={jest.fn()} />)

    expect(screen.getByRole('button', { name: /reset chat/i })).toBeInTheDocument()
  })

  it('opens dialog and shows confirmation copy', async () => {
    const user = userEvent.setup()
    render(<ResetChatDialog onConfirmReset={jest.fn()} />)

    await user.click(screen.getByRole('button', { name: /reset chat/i }))

    expect(screen.getByText('Start a new chat session?')).toBeInTheDocument()
    expect(
      screen.getByText('This will clear your chat history and cannot be undone.'),
    ).toBeInTheDocument()
  })

  it('closes dialog on cancel without clearing history', async () => {
    const user = userEvent.setup()
    const onConfirmReset = jest.fn()
    render(<ResetChatDialog onConfirmReset={onConfirmReset} />)

    await user.click(screen.getByRole('button', { name: /reset chat/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onConfirmReset).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByText('Start a new chat session?')).not.toBeInTheDocument()
    })
  })

  it('calls onConfirmReset when user confirms reset', async () => {
    const user = userEvent.setup()
    const onConfirmReset = jest.fn()
    render(<ResetChatDialog onConfirmReset={onConfirmReset} />)

    await user.click(screen.getByRole('button', { name: /reset chat/i }))
    await user.click(screen.getByRole('button', { name: /yes, reset chat/i }))

    expect(onConfirmReset).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.queryByText('Start a new chat session?')).not.toBeInTheDocument()
    })
  })
})
