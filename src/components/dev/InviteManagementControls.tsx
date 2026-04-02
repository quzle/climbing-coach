'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ApiResponse } from '@/types'

type InviteResponse = {
  invited_email: string
}

const inviteSchema = z.object({
  email: z.string().email('Enter a valid email address').max(320),
})

type InviteFormValues = z.infer<typeof inviteSchema>

type InviteState =
  | { status: 'idle'; message: null }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

/**
 * @description Superuser-only invite form for dev dashboard flows.
 * @returns Invite management card wired to POST /api/invites.
 */
export function InviteManagementControls(): React.JSX.Element {
  const [inviteState, setInviteState] = useState<InviteState>({ status: 'idle', message: null })

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
    },
  })

  async function onSubmit(values: InviteFormValues): Promise<void> {
    setInviteState({ status: 'idle', message: null })

    try {
      const response = await fetch('/api/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })
      const json = (await response.json()) as ApiResponse<InviteResponse>

      if (!response.ok || json.error !== null || json.data === null) {
        setInviteState({ status: 'error', message: json.error ?? 'Failed to send invite.' })
        return
      }

      setInviteState({
        status: 'success',
        message: `Invite sent to ${json.data.invited_email}.`,
      })
      form.reset()
    } catch {
      setInviteState({ status: 'error', message: 'Failed to send invite.' })
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border-2 border-blue-200 bg-blue-50/70 p-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Invite Management</h2>
        <p className="text-sm text-slate-600">
          Send a new invite email through the authenticated superuser endpoint.
        </p>
      </div>

      <form className="space-y-2" noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-900" htmlFor="invite-email">
            Invite Email
          </label>
          <Input
            id="invite-email"
            type="email"
            className="min-h-[44px]"
            placeholder="climber@example.com"
            {...form.register('email')}
          />
          {form.formState.errors.email ? (
            <p className="text-sm text-red-600" role="status">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>

        <Button type="submit" className="min-h-[44px]" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Sending Invite...' : 'Send Invite'}
        </Button>
      </form>

      {inviteState.message !== null ? (
        <p
          className={
            inviteState.status === 'error' ? 'text-sm text-red-600' : 'text-sm text-blue-700'
          }
          role="status"
        >
          {inviteState.message}
        </p>
      ) : null}
    </section>
  )
}
