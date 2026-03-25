'use client'

import { useState } from 'react'
import type { InjuryArea, InjuryAreaHealth, InjuryAreaRow } from '@/types'
import { RatingSelector } from '@/components/forms/RatingSelector'
import { Button } from '@/components/ui/button'

// =============================================================================
// AREA LABELS
// =============================================================================

const AREA_LABELS: Record<string, string> = {
  shoulder_left: 'Shoulder (left)',
  shoulder_right: 'Shoulder (right)',
  finger_a2_left: 'A2 pulley (left)',
  finger_a2_right: 'A2 pulley (right)',
  finger_a4_left: 'A4 pulley (left)',
  finger_a4_right: 'A4 pulley (right)',
  finger_pip_left: 'PIP joint (left)',
  finger_pip_right: 'PIP joint (right)',
  elbow_medial_left: 'Medial elbow (left)',
  elbow_medial_right: 'Medial elbow (right)',
  elbow_lateral_left: 'Lateral elbow (left)',
  elbow_lateral_right: 'Lateral elbow (right)',
  wrist_left: 'Wrist (left)',
  wrist_right: 'Wrist (right)',
  knee_left: 'Knee (left)',
  knee_right: 'Knee (right)',
  ankle_left: 'Ankle (left)',
  ankle_right: 'Ankle (right)',
  lower_back: 'Lower back',
  neck: 'Neck',
  hip_flexor_left: 'Hip flexor (left)',
  hip_flexor_right: 'Hip flexor (right)',
}

/** All known injury areas in display order. */
export const KNOWN_AREAS: InjuryArea[] = Object.keys(AREA_LABELS) as InjuryArea[]

/**
 * @description Returns a human-readable label for an injury area identifier.
 * Falls back to title-casing the raw string for unknown areas.
 *
 * @param area The raw injury area string (e.g. "shoulder_left")
 * @returns Human-readable label (e.g. "Shoulder (left)")
 */
export function formatAreaName(area: string): string {
  return (
    AREA_LABELS[area] ??
    area
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

// =============================================================================
// COMPONENT
// =============================================================================

const HEALTH_LABELS: [string, string, string, string, string] = [
  'Cannot train',
  'Painful',
  'Sore',
  'Good',
  'Pain-free',
]

/**
 * Props for the InjuryAreaSelector component.
 *
 * @property areas     Active tracked injury areas fetched from the database.
 * @property value     Current health ratings for each area.
 * @property onChange  Callback fired with the updated ratings array when any
 *                     rating changes.
 * @property onAddArea Optional callback invoked with the selected area name when
 *                     the athlete taps "Track". The parent is responsible for
 *                     persisting the new area via the API.
 * @property disabled  When true, all inputs are non-interactive.
 */
type InjuryAreaSelectorProps = {
  areas: InjuryAreaRow[]
  value: InjuryAreaHealth[]
  onChange: (value: InjuryAreaHealth[]) => void
  onAddArea?: (area: string) => void
  disabled?: boolean
}

/**
 * InjuryAreaSelector renders a `RatingSelector` row for each currently tracked
 * injury area, plus an optional "+ Track new area" control when `onAddArea` is
 * provided. It is designed to replace the fixed shoulder-health step inside
 * ReadinessForm.
 *
 * @example
 * <InjuryAreaSelector
 *   areas={activeAreas}
 *   value={injuryAreaHealth}
 *   onChange={setInjuryAreaHealth}
 *   onAddArea={handleAddArea}
 * />
 */
export function InjuryAreaSelector({
  areas,
  value,
  onChange,
  onAddArea,
  disabled = false,
}: InjuryAreaSelectorProps) {
  const [pendingArea, setPendingArea] = useState<string>('')

  const trackedAreaNames = new Set(areas.map((a) => a.area))
  const availableToAdd = KNOWN_AREAS.filter((a) => !trackedAreaNames.has(a))

  function handleRatingChange(area: string, health: number) {
    const exists = value.some((v) => v.area === area)
    if (exists) {
      onChange(value.map((v) => (v.area === area ? { ...v, health } : v)))
    } else {
      onChange([...value, { area, health, notes: null }])
    }
  }

  function handleTrack() {
    if (!pendingArea || !onAddArea) return
    onAddArea(pendingArea)
    setPendingArea('')
  }

  if (areas.length === 0 && !onAddArea) {
    return (
      <p className="text-center text-slate-500 text-sm py-4">
        No injury areas tracked. Add areas via your profile page.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {areas.map((areaRow) => {
        const currentHealth =
          value.find((v) => v.area === areaRow.area)?.health ?? null

        return (
          <div key={areaRow.area} className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              {formatAreaName(areaRow.area)}
            </span>
            <RatingSelector
              name={areaRow.area}
              value={currentHealth}
              labels={HEALTH_LABELS}
              disabled={disabled}
              onChange={(val) => handleRatingChange(areaRow.area, val)}
            />
          </div>
        )
      })}

      {onAddArea && availableToAdd.length > 0 && (
        <div className="flex gap-2 items-center pt-2 border-t border-slate-100">
          {/* Native select used here for JSDOM test compatibility */}
          <select
            aria-label="Select injury area to track"
            value={pendingArea}
            onChange={(e) => setPendingArea(e.target.value)}
            disabled={disabled}
            className="flex-1 min-h-[44px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <option value="">Select area to track…</option>
            {availableToAdd.map((area) => (
              <option key={area} value={area}>
                {formatAreaName(area)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            disabled={disabled || !pendingArea}
            onClick={handleTrack}
          >
            Track
          </Button>
        </div>
      )}
    </div>
  )
}
