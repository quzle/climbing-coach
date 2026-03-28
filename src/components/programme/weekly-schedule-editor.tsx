'use client'

import { useState } from 'react'
import type { GeneratedWeeklyTemplate, DayPin } from '@/lib/programme-wizard'
import { DAY_LABELS } from '@/lib/programme-wizard'

// =============================================================================
// TYPES
// =============================================================================

export type WeeklyScheduleEditorProps = {
  slots: GeneratedWeeklyTemplate[]
  availableDays: number[]
  lockedDayPins: DayPin[]
  onChange: (slots: GeneratedWeeklyTemplate[]) => void
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SESSION_EMOJIS: Record<string, string> = {
  bouldering: '🧱',
  kilterboard: '🎯',
  lead: '🧗',
  fingerboard: '🤞',
  strength: '💪',
  aerobic: '🏃',
  rest: '😴',
  mobility: '🧘',
}

const INTENSITY_COLOR: Record<string, string> = {
  high: 'text-red-600',
  medium: 'text-amber-600',
  low: 'text-emerald-600',
}

// =============================================================================
// INITIALIZATION HELPERS
// =============================================================================

function initPlaced(
  slots: GeneratedWeeklyTemplate[],
  availableDays: number[],
): Map<number, GeneratedWeeklyTemplate> {
  const map = new Map<number, GeneratedWeeklyTemplate>()
  for (const slot of slots) {
    if (availableDays.includes(slot.day_of_week) && !map.has(slot.day_of_week)) {
      map.set(slot.day_of_week, slot)
    }
  }
  return map
}

function initUnplaced(
  slots: GeneratedWeeklyTemplate[],
  availableDays: number[],
): GeneratedWeeklyTemplate[] {
  const placed = initPlaced(slots, availableDays)
  return slots.filter((s) => !placed.has(s.day_of_week) || placed.get(s.day_of_week) !== s)
}

function initUserLocks(pins: DayPin[], _slots: GeneratedWeeklyTemplate[]): Set<number> {
  const locks = new Set<number>()
  for (const pin of pins) {
    if (pin.locked) {
      locks.add(pin.day_of_week)
    }
  }
  return locks
}

// =============================================================================
// HELPER: isHardLocked
// =============================================================================

function isHardLocked(
  day: number,
  slot: GeneratedWeeklyTemplate,
  lockedDayPins: DayPin[],
): boolean {
  return lockedDayPins.some(
    (p) => p.locked && p.day_of_week === day && p.style === slot.session_type,
  )
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function WeeklyScheduleEditor({
  slots,
  availableDays,
  lockedDayPins,
  onChange,
}: WeeklyScheduleEditorProps): React.JSX.Element {
  const [placed, setPlaced] = useState<Map<number, GeneratedWeeklyTemplate>>(() =>
    initPlaced(slots, availableDays),
  )
  const [unplaced, setUnplaced] = useState<GeneratedWeeklyTemplate[]>(() =>
    initUnplaced(slots, availableDays),
  )
  const [selected, setSelected] = useState<{
    slot: GeneratedWeeklyTemplate
    fromDay: number | null
  } | null>(null)
  const [userLocks, setUserLocks] = useState<Set<number>>(() =>
    initUserLocks(lockedDayPins, slots),
  )

  function emitChange(newPlaced: Map<number, GeneratedWeeklyTemplate>) {
    onChange(Array.from(newPlaced.values()))
  }

  // ---------------------------------------------------------------------------
  // Tap a slot in the unplaced pool
  // ---------------------------------------------------------------------------
  function handleSelectUnplaced(slot: GeneratedWeeklyTemplate) {
    if (selected?.slot === slot && selected.fromDay === null) {
      setSelected(null)
      return
    }
    setSelected({ slot, fromDay: null })
  }

  // ---------------------------------------------------------------------------
  // Tap a placed slot (to pick it up)
  // ---------------------------------------------------------------------------
  function handleSelectPlaced(day: number, slot: GeneratedWeeklyTemplate) {
    if (isHardLocked(day, slot, lockedDayPins)) return

    if (selected !== null) {
      // Already have something selected — treat this as placing into this day
      handleTapDay(day)
      return
    }

    if (selected === null && placed.get(day) === slot) {
      setSelected({ slot, fromDay: day })
    }
  }

  // ---------------------------------------------------------------------------
  // Tap a day column to place the selected slot
  // ---------------------------------------------------------------------------
  function handleTapDay(targetDay: number) {
    if (selected === null) return
    if (!availableDays.includes(targetDay)) return

    const { slot: movingSlot, fromDay } = selected

    const newPlaced = new Map(placed)
    const newUnplaced = [...unplaced]

    const existingAtTarget = newPlaced.get(targetDay)

    if (existingAtTarget !== undefined) {
      // Swap
      newPlaced.set(targetDay, movingSlot)

      if (fromDay !== null) {
        // Move existing slot to where the moving slot came from
        newPlaced.set(fromDay, existingAtTarget)
      } else {
        // Moving slot came from unplaced; push existing back to unplaced
        const idx = newUnplaced.indexOf(movingSlot)
        if (idx !== -1) newUnplaced.splice(idx, 1)
        newUnplaced.push(existingAtTarget)
      }
    } else {
      // Empty target
      newPlaced.set(targetDay, movingSlot)

      if (fromDay !== null) {
        newPlaced.delete(fromDay)
      } else {
        const idx = newUnplaced.indexOf(movingSlot)
        if (idx !== -1) newUnplaced.splice(idx, 1)
      }
    }

    setPlaced(newPlaced)
    setUnplaced(newUnplaced)
    setSelected(null)
    emitChange(newPlaced)
  }

  // ---------------------------------------------------------------------------
  // Remove a placed slot (send back to unplaced pool)
  // ---------------------------------------------------------------------------
  function handleRemovePlaced(day: number) {
    const slot = placed.get(day)
    if (!slot) return
    if (isHardLocked(day, slot, lockedDayPins)) return

    const newPlaced = new Map(placed)
    newPlaced.delete(day)
    const newUnplaced = [...unplaced, slot]

    setPlaced(newPlaced)
    setUnplaced(newUnplaced)
    emitChange(newPlaced)
  }

  // ---------------------------------------------------------------------------
  // Toggle user lock
  // ---------------------------------------------------------------------------
  function handleToggleLock(day: number) {
    const slot = placed.get(day)
    if (!slot) return
    if (isHardLocked(day, slot, lockedDayPins)) return

    const newLocks = new Set(userLocks)
    if (newLocks.has(day)) {
      newLocks.delete(day)
    } else {
      newLocks.add(day)
    }
    setUserLocks(newLocks)
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

  return (
    <div className="space-y-4">
      {/* Selection banner */}
      {selected !== null && (
        <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
          <p className="text-sm font-medium text-blue-800">
            Tap a day to place{' '}
            <span className="font-semibold">
              {SESSION_EMOJIS[selected.slot.session_type] ?? ''} {selected.slot.session_label}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="ml-3 shrink-0 rounded-md border border-blue-300 bg-white px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Unplaced pool */}
      {unplaced.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
            Unplaced sessions
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {unplaced.map((slot, i) => {
              const isSelectedSlot = selected?.slot === slot && selected.fromDay === null
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectUnplaced(slot)}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    isSelectedSlot
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-400'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="font-medium text-slate-800">
                    {SESSION_EMOJIS[slot.session_type] ?? ''} {slot.session_label}
                  </span>
                  <span
                    className={`ml-1.5 text-xs font-medium ${INTENSITY_COLOR[slot.intensity] ?? ''}`}
                  >
                    {slot.intensity}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Weekly grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {ALL_DAYS.map((day) => {
          const isAvailable = availableDays.includes(day)
          const placedSlot = placed.get(day)
          const isSelectedFromDay =
            selected !== null && selected.fromDay === day

          return (
            <div key={day} className="flex flex-col gap-1">
              {/* Day header */}
              <p
                className={`text-center text-xs font-semibold uppercase tracking-wide ${
                  isAvailable ? 'text-slate-700' : 'text-slate-300'
                }`}
              >
                {DAY_LABELS[day]}
              </p>

              {/* Day slot */}
              {!isAvailable ? (
                // Unavailable day
                <div className="min-h-[80px] rounded-lg bg-slate-50 opacity-40" />
              ) : placedSlot !== undefined ? (
                // Placed slot card
                <PlacedSlotCard
                  day={day}
                  slot={placedSlot}
                  isSelected={isSelectedFromDay}
                  isHard={isHardLocked(day, placedSlot, lockedDayPins)}
                  isUserLocked={userLocks.has(day)}
                  hasActiveSelection={selected !== null}
                  onSelect={() => handleSelectPlaced(day, placedSlot)}
                  onTapDay={() => handleTapDay(day)}
                  onRemove={() => handleRemovePlaced(day)}
                  onToggleLock={() => handleToggleLock(day)}
                />
              ) : (
                // Empty available day
                <button
                  type="button"
                  onClick={() => handleTapDay(day)}
                  className={`min-h-[80px] w-full rounded-lg border-2 border-dashed transition-colors ${
                    selected !== null
                      ? 'border-blue-300 bg-blue-50 hover:border-blue-400 hover:bg-blue-100'
                      : 'border-slate-200 bg-white'
                  }`}
                  aria-label={`Place on ${DAY_LABELS[day]}`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// PLACED SLOT CARD SUB-COMPONENT
// =============================================================================

type PlacedSlotCardProps = {
  day: number
  slot: GeneratedWeeklyTemplate
  isSelected: boolean
  isHard: boolean
  isUserLocked: boolean
  hasActiveSelection: boolean
  onSelect: () => void
  onTapDay: () => void
  onRemove: () => void
  onToggleLock: () => void
}

function PlacedSlotCard({
  slot,
  isSelected,
  isHard,
  isUserLocked,
  hasActiveSelection,
  onSelect,
  onTapDay,
  onRemove,
  onToggleLock,
}: PlacedSlotCardProps): React.JSX.Element {
  const locked = isHard || isUserLocked

  function handleCardClick() {
    if (hasActiveSelection) {
      onTapDay()
    } else {
      onSelect()
    }
  }

  return (
    <div
      className={`relative min-h-[80px] rounded-lg border p-1.5 transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-400'
          : hasActiveSelection
            ? 'cursor-pointer border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50'
            : isHard
              ? 'border-slate-200 bg-white cursor-default'
              : 'cursor-pointer border-slate-200 bg-white hover:border-slate-300'
      }`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCardClick()
        }
      }}
    >
      {/* Lock icon — top right */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggleLock()
        }}
        disabled={isHard}
        className={`absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded text-xs leading-none ${
          isHard
            ? 'cursor-default text-slate-400'
            : isUserLocked
              ? 'text-blue-600 hover:text-blue-800'
              : 'text-slate-300 hover:text-slate-500'
        }`}
        aria-label={locked ? 'Locked' : 'Unlocked'}
      >
        {locked ? '🔒' : '🔓'}
      </button>

      {/* Session label */}
      <p className="pr-5 text-xs font-semibold leading-tight text-slate-800 line-clamp-2">
        {SESSION_EMOJIS[slot.session_type] ?? ''} {slot.session_label}
      </p>

      {/* Type + intensity */}
      <p className={`mt-0.5 text-xs ${INTENSITY_COLOR[slot.intensity] ?? 'text-slate-500'}`}>
        {slot.session_type} · {slot.intensity}
      </p>

      {/* Duration */}
      <p className="text-xs text-slate-400">{slot.duration_mins}m</p>

      {/* Remove button — bottom right, only when not hard-locked and not selected */}
      {!isHard && !isSelected && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded text-xs text-slate-300 hover:text-red-500"
          aria-label="Remove from day"
        >
          ×
        </button>
      )}
    </div>
  )
}
