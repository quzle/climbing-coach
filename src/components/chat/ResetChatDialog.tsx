'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type ResetChatDialogProps = {
  /** Called after user confirms reset. */
  onConfirmReset: () => void
}

/**
 * @description Renders a reset-chat button and confirmation dialog before
 * clearing persisted chat history.
 * @param onConfirmReset Invoked when the user confirms chat reset
 * @returns Reset trigger and confirmation dialog UI
 */
export function ResetChatDialog({ onConfirmReset }: ResetChatDialogProps): React.JSX.Element {
  const [open, setOpen] = useState(false)

  function handleConfirm(): void {
    onConfirmReset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          aria-label="Reset chat"
        >
          Reset chat
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a new chat session?</DialogTitle>
          <DialogDescription>
            This will clear your chat history and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="min-h-[44px]">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            className="min-h-[44px]"
            onClick={handleConfirm}
          >
            Yes, reset chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
