/**
 * @description Returns all localStorage keys that belong to the given user.
 * Matches keys prefixed with `climbing-coach:*:${userId}` — specifically
 * the session-draft and chat-history families.
 *
 * @param userId The authenticated user's UUID
 * @returns Array of matching localStorage key strings
 */
export function getUserStorageKeys(userId: string): string[] {
  const prefixes = [
    `climbing-coach:session-draft:${userId}`,
    `climbing-coach:chat-history:${userId}`,
  ]
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key !== null && prefixes.some((prefix) => key.startsWith(prefix))) {
      keys.push(key)
    }
  }
  return keys
}

/**
 * @description Removes all user-scoped localStorage entries for the given
 * user. Call this on logout to prevent data leakage when multiple accounts
 * share a browser.
 *
 * @param userId The authenticated user's UUID
 */
export function clearUserStorage(userId: string): void {
  const keys = getUserStorageKeys(userId)
  keys.forEach((key) => localStorage.removeItem(key))
}
