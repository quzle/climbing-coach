import { useState, useEffect, useCallback } from 'react'
import type {
  SessionType,
  ClimbingAttempt,
  FingerboardSet,
  StrengthExercise,
} from '@/types'

// =============================================================================
// TYPES
// =============================================================================

export type SessionDraft = {
  sessionType: SessionType | null
  date: string
  location: string | null
  duration_mins: number | null
  quality_rating: number | null
  rpe: number | null
  injury_flags: string[]
  notes: string | null
  attempts: ClimbingAttempt[]
  fingerboardSets: FingerboardSet[]
  exercises: StrengthExercise[]
  /** ISO timestamp of the last save — used to enforce expiry. */
  lastSaved: string
  stage: 1 | 2
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Drafts older than this are discarded on load.
 * A session started yesterday should not be restored today.
 */
const DRAFT_EXPIRY_HOURS = 12

/**
 * @description Returns the localStorage key for the given user's draft.
 * Scoped per user to prevent draft leakage when multiple accounts share a
 * browser.
 *
 * @param userId The authenticated user's UUID
 * @returns The localStorage key string
 */
function draftKey(userId: string): string {
  return `climbing-coach:session-draft:${userId}`
}

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/**
 * @description Returns true if the draft was saved more than
 * `DRAFT_EXPIRY_HOURS` ago and should be discarded.
 *
 * @param draft The draft to evaluate
 * @returns Whether the draft has expired
 */
function isDraftExpired(draft: SessionDraft): boolean {
  const savedAt = Date.parse(draft.lastSaved)
  if (isNaN(savedAt)) return true
  const expiryMs = DRAFT_EXPIRY_HOURS * 60 * 60 * 1000
  return Date.now() - savedAt > expiryMs
}

/**
 * @description Reads and parses the draft from localStorage.
 * Returns null if reading fails, the JSON is corrupted, or the draft
 * has expired (also clears the expired draft from storage).
 *
 * @param key The user-scoped localStorage key
 * @returns The stored draft, or null if none / expired / unreadable
 */
function loadDraft(key: string): SessionDraft | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null

    const parsed = JSON.parse(raw) as SessionDraft

    if (isDraftExpired(parsed)) {
      clearDraftFromStorage(key)
      return null
    }

    return parsed
  } catch {
    return null
  }
}

/**
 * @description Serialises the draft and writes it to localStorage.
 * Logs a warning if storage is unavailable or quota is exceeded —
 * the draft is held in React state regardless, so the form continues
 * to function without persistence.
 *
 * @param key The user-scoped localStorage key
 * @param draft The draft to persist
 */
function saveDraftToStorage(key: string, draft: SessionDraft): void {
  try {
    localStorage.setItem(key, JSON.stringify(draft))
  } catch (err) {
    console.warn('[useDraftSession] Failed to save draft to localStorage:', err)
  }
}

/**
 * @description Removes the draft entry from localStorage.
 * Errors are silently swallowed — if storage is inaccessible there
 * is nothing useful to do.
 *
 * @param key The user-scoped localStorage key
 */
function clearDraftFromStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Intentionally empty — storage may be locked in some security configs.
  }
}

/**
 * @description Returns the default shape for a new draft with no lastSaved
 * timestamp. The caller must add `lastSaved` before writing to storage.
 *
 * @returns Blank draft fields with today's date and empty arrays
 */
function getEmptyDraft(): Omit<SessionDraft, 'lastSaved'> {
  return {
    sessionType: null,
    date: new Date().toISOString().split('T')[0]!,
    location: null,
    duration_mins: null,
    quality_rating: null,
    rpe: null,
    injury_flags: [],
    notes: null,
    attempts: [],
    fingerboardSets: [],
    exercises: [],
    stage: 1,
  }
}

// =============================================================================
// HOOK
// =============================================================================

export type UseDraftSessionReturn = {
  /** The current in-memory draft, or null if none exists. */
  draft: SessionDraft | null
  /** True when a non-expired draft is present. Use to offer a restore prompt. */
  hasDraft: boolean
  /**
   * Merges `updates` into the current draft (or an empty draft) and persists
   * the result to both state and localStorage.
   */
  saveDraft: (updates: Partial<SessionDraft>) => void
  /** Clears the draft from both state and localStorage. */
  clearDraft: () => void
  /**
   * Returns the current draft from state for the form to consume.
   * Does not modify state — the component decides what to do with the values.
   */
  restoreDraft: () => SessionDraft | null
}

/**
 * @description Persists session log form state to localStorage so progress
 * is not lost if the browser crashes, the tab is closed, or the connection
 * drops mid-session.
 *
 * Drafts expire after 12 hours — a session started yesterday will not be
 * restored today. The hook does NOT auto-restore on mount; it loads the
 * stored draft into state and surfaces `hasDraft` so the consuming component
 * can offer the user a deliberate choice.
 *
 * @returns Draft state and imperative helpers for save / clear / restore.
 *
 * @param userId The authenticated user's UUID — used to scope the localStorage key
 * @example
 * const { hasDraft, draft, saveDraft, clearDraft, restoreDraft } = useDraftSession(userId)
 *
 * // Offer restore prompt
 * if (hasDraft) { ... }
 *
 * // Save on every form change
 * saveDraft({ sessionType: 'bouldering', attempts })
 *
 * // Populate form from draft
 * const saved = restoreDraft()
 */
export function useDraftSession(userId: string): UseDraftSessionReturn {
  const key = draftKey(userId)
  const [draft, setDraft] = useState<SessionDraft | null>(null)

  // Load on mount — do not auto-restore, just make it available.
  useEffect(() => {
    const stored = loadDraft(key)
    if (stored !== null) {
      setDraft(stored)
    }
  }, [key])

  /**
   * @description Merges `updates` into the current draft and persists the
   * result. Safe to call on every keystroke — localStorage writes are
   * wrapped in try/catch.
   *
   * @param updates Partial draft fields to merge
   */
  const saveDraft = useCallback(
    (updates: Partial<SessionDraft>) => {
      const newDraft: SessionDraft = {
        ...(draft ?? getEmptyDraft()),
        ...updates,
        lastSaved: new Date().toISOString(),
      }
      setDraft(newDraft)
      saveDraftToStorage(key, newDraft)
    },
    [draft, key],
  )

  /**
   * @description Removes the draft from state and localStorage.
   * Call this after a successful submission or when the user explicitly
   * discards their draft.
   */
  const clearDraft = useCallback(() => {
    setDraft(null)
    clearDraftFromStorage(key)
  }, [key])

  /**
   * @description Returns the current draft from React state.
   * The component is responsible for applying values to its own form state.
   *
   * @returns The current draft, or null if none exists
   */
  const restoreDraft = useCallback((): SessionDraft | null => {
    return draft
  }, [draft])

  return {
    draft,
    hasDraft: draft !== null,
    saveDraft,
    clearDraft,
    restoreDraft,
  }
}
