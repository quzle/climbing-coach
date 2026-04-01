'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

// =============================================================================
// SCHEMA
// =============================================================================

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

type LoginFormData = z.infer<typeof loginSchema>

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * @description Login page content that reads query params and authenticates
 * invited users with Supabase Auth.
 * @returns Login page content element.
 */
function LoginPageContent(): React.JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackError = searchParams.get('error')

  const [serverError, setServerError] = useState<string | null>(
    callbackError === 'callback_failed' || callbackError === 'confirm_failed'
      ? 'The sign-in link has expired or is invalid. Please try again.'
      : null,
  )
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormData): Promise<void> {
    setServerError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: data.email,
      })

      if (error) {
        // Never expose the raw Supabase error to the user.
        console.error('[LoginPage] signInWithOtp failed:', error.message)
        setServerError('Unable to send sign-in link. Please try again.')
        return
      }

      setSuccessMessage('Check your email for a sign-in link.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-center text-2xl">Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {serverError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </p>
          )}
          {successMessage && (
            <p
              role="status"
              className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700"
            >
              {successMessage}
            </p>
          )}

          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="min-h-[44px]"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="min-h-[44px] w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending link...' : 'Send sign-in link'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

/**
 * @description Login page wrapper. The inner client content reads search
 * params, so it must render under Suspense for static prerender.
 * @returns Login page element.
 */
export default function LoginPage(): React.JSX.Element {
  return (
    <Suspense fallback={<div className="min-h-[1px]" />}>
      <LoginPageContent />
    </Suspense>
  )
}
