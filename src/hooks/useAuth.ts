import { useAuthContext } from '@/components/providers/auth-provider'

/**
 * @description Returns the shared authenticated user and profile state for
 * client components.
 * @returns Auth/profile context value
 */
export function useAuth() {
  return useAuthContext()
}