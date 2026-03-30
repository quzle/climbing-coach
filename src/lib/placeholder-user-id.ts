/**
 * Temporary single-user placeholder until AUTH-4 (`getCurrentUser()`) is implemented.
 *
 * Every usage of this constant is a future replacement site: it must be
 * swapped for the real authenticated user ID once the auth layer is wired in
 * (see docs/architecture/multi-user-migration-plan.md, REPO-1 through API-9).
 */
export const SINGLE_USER_PLACEHOLDER_ID = '00000000-0000-0000-0000-000000000001' as const
