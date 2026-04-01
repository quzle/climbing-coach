'use client'

import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

const changePasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string().min(8, 'Confirm your new password'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  })

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>

function ChangePasswordPageContent(): React.JSX.Element {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  })

  async function onSubmit(data: ChangePasswordFormData): Promise<void> {
    setServerError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      })

      if (error) {
        console.error('[ChangePasswordPage] updateUser failed:', error.message)
        setServerError('Unable to update password. Please try again.')
        return
      }

      setSuccessMessage('Password updated successfully. Redirecting to your account...')
      router.push('/profile')
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-center text-2xl">Set password</CardTitle>
        <CardDescription>
          Choose a password for your account after confirming your recovery email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {serverError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </p>
          )}
          {successMessage && (
            <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              {successMessage}
            </p>
          )}

          <div className="space-y-1">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              className="min-h-[44px]"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="min-h-[44px]"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" className="min-h-[44px] w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Updating password...' : 'Update password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

/**
 * @description Password update page used after Supabase recovery link confirmation.
 * @returns Change-password page element
 */
export default function ChangePasswordPage(): React.JSX.Element {
  return (
    <Suspense fallback={<div className="min-h-[1px]" />}>
      <ChangePasswordPageContent />
    </Suspense>
  )
}