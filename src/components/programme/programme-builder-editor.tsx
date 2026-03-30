'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type {
  ApiResponse,
  Mesocycle,
  Programme,
  ProgrammeBuilderSnapshot,
  WeeklyTemplate,
} from '@/types'

const programmeSchema = z.object({
  name: z.string().min(1).max(120),
  goal: z.string().min(1).max(300),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).nullable(),
})

const mesocycleSchema = z.object({
  name: z.string().min(1).max(120),
  focus: z.string().min(1).max(500),
  phase_type: z.enum([
    'base',
    'power',
    'power_endurance',
    'climbing_specific',
    'performance',
    'deload',
  ]),
  planned_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  planned_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['completed', 'active', 'interrupted', 'planned']),
  interruption_notes: z.string().max(1000).nullable(),
})

const weeklyTemplateSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  session_label: z.string().min(1).max(120),
  session_type: z.enum([
    'bouldering',
    'kilterboard',
    'lead',
    'fingerboard',
    'strength',
    'aerobic',
    'rest',
    'mobility',
  ]),
  intensity: z.enum(['high', 'medium', 'low']),
  duration_mins: z.number().int().min(1).max(480).nullable(),
  primary_focus: z.string().max(200).nullable(),
  notes: z.string().max(1000).nullable(),
})

type ProgrammeFormValues = z.infer<typeof programmeSchema>
type MesocycleFormValues = z.infer<typeof mesocycleSchema>
type WeeklyTemplateFormValues = z.infer<typeof weeklyTemplateSchema>

type ProgrammeBuilderEditorProps = {
  snapshot: ProgrammeBuilderSnapshot
  onSaved: () => Promise<void>
}

const DAY_OPTIONS = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
]

/**
 * @description Laptop-primary programme builder editor for Phase 2C.
 * Provides inline forms to update programme metadata, active mesocycle fields,
 * and weekly template slots without leaving the planner page.
 */
export function ProgrammeBuilderEditor({
  snapshot,
  onSaved,
}: ProgrammeBuilderEditorProps): React.JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const [isSavingProgramme, setIsSavingProgramme] = useState(false)
  const [isSavingMesocycle, setIsSavingMesocycle] = useState(false)
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [isAddingTemplate, setIsAddingTemplate] = useState(false)


  const selectedTemplate = useMemo(() => {
    return snapshot.currentWeeklyTemplate[0] ?? null
  }, [snapshot.currentWeeklyTemplate])

  const programmeForm = useForm<ProgrammeFormValues>({
    resolver: zodResolver(programmeSchema),
    values: {
      name: snapshot.currentProgramme?.name ?? '',
      goal: snapshot.currentProgramme?.goal ?? '',
      start_date: snapshot.currentProgramme?.start_date ?? '',
      target_date: snapshot.currentProgramme?.target_date ?? '',
      notes: snapshot.currentProgramme?.notes ?? null,
    },
  })

  const mesocycleForm = useForm<MesocycleFormValues>({
    resolver: zodResolver(mesocycleSchema),
    values: {
      name: snapshot.activeMesocycle?.name ?? '',
      focus: snapshot.activeMesocycle?.focus ?? '',
      phase_type: (snapshot.activeMesocycle?.phase_type ?? 'base') as MesocycleFormValues['phase_type'],
      planned_start: snapshot.activeMesocycle?.planned_start ?? '',
      planned_end: snapshot.activeMesocycle?.planned_end ?? '',
      status: (snapshot.activeMesocycle?.status ?? 'planned') as MesocycleFormValues['status'],
      interruption_notes: snapshot.activeMesocycle?.interruption_notes ?? null,
    },
  })

  const templateForm = useForm<WeeklyTemplateFormValues>({
    resolver: zodResolver(weeklyTemplateSchema),
    values: {
      day_of_week: selectedTemplate?.day_of_week ?? 0,
      session_label: selectedTemplate?.session_label ?? '',
      session_type: (selectedTemplate?.session_type ?? 'rest') as WeeklyTemplateFormValues['session_type'],
      intensity: (selectedTemplate?.intensity ?? 'low') as WeeklyTemplateFormValues['intensity'],
      duration_mins: selectedTemplate?.duration_mins ?? null,
      primary_focus: selectedTemplate?.primary_focus ?? null,
      notes: selectedTemplate?.notes ?? null,
    },
  })

  const addTemplateForm = useForm<WeeklyTemplateFormValues>({
    resolver: zodResolver(weeklyTemplateSchema),
    defaultValues: {
      day_of_week: 0,
      session_label: '',
      session_type: 'bouldering',
      intensity: 'medium',
      duration_mins: null,
      primary_focus: null,
      notes: null,
    },
  })

  async function submitProgramme(values: ProgrammeFormValues): Promise<void> {
    setError(null)
    setIsSavingProgramme(true)
    try {
      const isCreate = snapshot.currentProgramme === null
      const currentProgrammeId = snapshot.currentProgramme?.id
      const response = await fetch(
        isCreate ? '/api/programmes' : `/api/programmes/${currentProgrammeId}`,
        {
          method: isCreate ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        },
      )
      const json = (await response.json()) as ApiResponse<{ programme: Programme }>
      if (!response.ok || json.error !== null) {
        setError(json.error ?? 'Failed to save programme settings.')
        return
      }
      await onSaved()
    } catch {
      setError('Failed to save programme settings.')
    } finally {
      setIsSavingProgramme(false)
    }
  }

  const programmeCardTitle =
    snapshot.currentProgramme === null ? 'Create Programme' : 'Programme Settings'
  const programmeButtonLabel =
    snapshot.currentProgramme === null
      ? isSavingProgramme
        ? 'Creating programme...'
        : 'Create Programme'
      : isSavingProgramme
        ? 'Saving programme...'
        : 'Save Programme'

  async function submitMesocycle(values: MesocycleFormValues): Promise<void> {
    if (snapshot.currentProgramme === null) return
    setError(null)
    setIsSavingMesocycle(true)
    const isCreate = snapshot.activeMesocycle === null
    try {
      const response = await fetch(
        isCreate ? '/api/mesocycles' : `/api/mesocycles/${snapshot.activeMesocycle!.id}`,
        {
          method: isCreate ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isCreate
              ? { ...values, programme_id: snapshot.currentProgramme.id, status: 'active' }
              : values,
          ),
        },
      )
      const json = (await response.json()) as ApiResponse<{ mesocycle: Mesocycle }>
      if (!response.ok || json.error !== null) {
        setError(json.error ?? 'Failed to save mesocycle.')
        return
      }
      await onSaved()
    } catch {
      setError('Failed to save mesocycle.')
    } finally {
      setIsSavingMesocycle(false)
    }
  }

  async function submitTemplate(values: WeeklyTemplateFormValues): Promise<void> {
    if (selectedTemplate === null) return
    setError(null)
    setIsSavingTemplate(true)
    try {
      const response = await fetch(`/api/weekly-templates/${selectedTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const json = (await response.json()) as ApiResponse<{ weeklyTemplate: WeeklyTemplate }>
      if (!response.ok || json.error !== null) {
        setError(json.error ?? 'Failed to save weekly template slot.')
        return
      }
      await onSaved()
    } catch {
      setError('Failed to save weekly template slot.')
    } finally {
      setIsSavingTemplate(false)
    }
  }

  async function submitAddTemplate(values: WeeklyTemplateFormValues): Promise<void> {
    if (snapshot.activeMesocycle === null) return
    setError(null)
    setIsAddingTemplate(true)
    try {
      const response = await fetch('/api/weekly-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, mesocycle_id: snapshot.activeMesocycle.id }),
      })
      const json = (await response.json()) as ApiResponse<{ weeklyTemplate: WeeklyTemplate }>
      if (!response.ok || json.error !== null) {
        setError(json.error ?? 'Failed to add template slot.')
        return
      }
      addTemplateForm.reset()
      await onSaved()
    } catch {
      setError('Failed to add template slot.')
    } finally {
      setIsAddingTemplate(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Programme Builder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Edit macrocycle settings, active block details, and your weekly template.
            This editor is optimized for desktop planning sessions.
          </p>
          {error !== null ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{programmeCardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={programmeForm.handleSubmit((values) => void submitProgramme(values))}
          >
            <div className="space-y-1 md:col-span-1">
              <Label htmlFor="programme-name">Name</Label>
              <Input id="programme-name" className="min-h-[44px]" {...programmeForm.register('name')} />
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label htmlFor="programme-goal">Goal</Label>
              <Input id="programme-goal" className="min-h-[44px]" {...programmeForm.register('goal')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="programme-start">Start Date</Label>
              <Input id="programme-start" type="date" className="min-h-[44px]" {...programmeForm.register('start_date')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="programme-target">Target Date</Label>
              <Input id="programme-target" type="date" className="min-h-[44px]" {...programmeForm.register('target_date')} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="programme-notes">Notes</Label>
              <Textarea
                id="programme-notes"
                className="min-h-[88px]"
                value={programmeForm.watch('notes') ?? ''}
                onChange={(event) =>
                  programmeForm.setValue('notes', event.target.value.length > 0 ? event.target.value : null)
                }
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" className="min-h-[44px]" disabled={isSavingProgramme}>
                {programmeButtonLabel}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {snapshot.currentProgramme !== null ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {snapshot.activeMesocycle === null ? 'Add Training Block' : 'Active Mesocycle'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={mesocycleForm.handleSubmit((values) => void submitMesocycle(values))}
            >
              <div className="space-y-1">
                <Label htmlFor="meso-name">Name</Label>
                <Input id="meso-name" className="min-h-[44px]" {...mesocycleForm.register('name')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="meso-phase">Phase Type</Label>
                <Select
                  value={mesocycleForm.watch('phase_type')}
                  onValueChange={(value) =>
                    mesocycleForm.setValue('phase_type', value as MesocycleFormValues['phase_type'])
                  }
                >
                  <SelectTrigger id="meso-phase" className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="base">Base</SelectItem>
                    <SelectItem value="power">Power</SelectItem>
                    <SelectItem value="power_endurance">Power Endurance</SelectItem>
                    <SelectItem value="climbing_specific">Climbing Specific</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="deload">Deload</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="meso-start">Planned Start</Label>
                <Input id="meso-start" type="date" className="min-h-[44px]" {...mesocycleForm.register('planned_start')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="meso-end">Planned End</Label>
                <Input id="meso-end" type="date" className="min-h-[44px]" {...mesocycleForm.register('planned_end')} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="meso-focus">Focus</Label>
                <Textarea id="meso-focus" className="min-h-[88px]" {...mesocycleForm.register('focus')} />
              </div>
              <div>
                <Button type="submit" className="min-h-[44px]" disabled={isSavingMesocycle}>
                  {snapshot.activeMesocycle === null
                    ? isSavingMesocycle ? 'Adding block...' : 'Add Training Block'
                    : isSavingMesocycle ? 'Saving mesocycle...' : 'Save Mesocycle'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {snapshot.activeMesocycle !== null ? (
        <Card>
          <CardHeader>
            <CardTitle>Add Template Slot</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={addTemplateForm.handleSubmit((values) => void submitAddTemplate(values))}
            >
              <div className="space-y-1">
                <Label htmlFor="add-template-day">Day</Label>
                <Select
                  value={String(addTemplateForm.watch('day_of_week'))}
                  onValueChange={(value) => addTemplateForm.setValue('day_of_week', Number(value))}
                >
                  <SelectTrigger id="add-template-day" className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-template-intensity">Intensity</Label>
                <Select
                  value={addTemplateForm.watch('intensity')}
                  onValueChange={(value) =>
                    addTemplateForm.setValue('intensity', value as WeeklyTemplateFormValues['intensity'])
                  }
                >
                  <SelectTrigger id="add-template-intensity" className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="add-template-label">Session Label</Label>
                <Input
                  id="add-template-label"
                  className="min-h-[44px]"
                  {...addTemplateForm.register('session_label')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-template-type">Session Type</Label>
                <Select
                  value={addTemplateForm.watch('session_type')}
                  onValueChange={(value) =>
                    addTemplateForm.setValue('session_type', value as WeeklyTemplateFormValues['session_type'])
                  }
                >
                  <SelectTrigger id="add-template-type" className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bouldering">Bouldering</SelectItem>
                    <SelectItem value="kilterboard">Kilterboard</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="fingerboard">Fingerboard</SelectItem>
                    <SelectItem value="strength">Strength</SelectItem>
                    <SelectItem value="aerobic">Aerobic</SelectItem>
                    <SelectItem value="rest">Rest</SelectItem>
                    <SelectItem value="mobility">Mobility</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-template-duration">Duration (mins)</Label>
                <Input
                  id="add-template-duration"
                  type="number"
                  className="min-h-[44px]"
                  value={addTemplateForm.watch('duration_mins') ?? ''}
                  onChange={(event) => {
                    const next = event.target.value
                    addTemplateForm.setValue('duration_mins', next.length > 0 ? Number(next) : null)
                  }}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="add-template-focus">Primary Focus</Label>
                <Input
                  id="add-template-focus"
                  className="min-h-[44px]"
                  value={addTemplateForm.watch('primary_focus') ?? ''}
                  onChange={(event) =>
                    addTemplateForm.setValue(
                      'primary_focus',
                      event.target.value.length > 0 ? event.target.value : null,
                    )
                  }
                />
              </div>
              <div>
                <Button type="submit" className="min-h-[44px]" disabled={isAddingTemplate}>
                  {isAddingTemplate ? 'Adding slot...' : 'Add Slot'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {selectedTemplate !== null ? (
        <Card>
          <CardHeader>
            <CardTitle>Weekly Template Slot</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={templateForm.handleSubmit((values) => void submitTemplate(values))}
            >
              <div className="space-y-1">
                <Label htmlFor="template-day">Day</Label>
                <Select
                  value={String(templateForm.watch('day_of_week'))}
                  onValueChange={(value) => templateForm.setValue('day_of_week', Number(value))}
                >
                  <SelectTrigger id="template-day" className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="template-intensity">Intensity</Label>
                <Select
                  value={templateForm.watch('intensity')}
                  onValueChange={(value) =>
                    templateForm.setValue('intensity', value as WeeklyTemplateFormValues['intensity'])
                  }
                >
                  <SelectTrigger id="template-intensity" className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="template-label">Session Label</Label>
                <Input
                  id="template-label"
                  className="min-h-[44px]"
                  {...templateForm.register('session_label')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="template-type">Session Type</Label>
                <Select
                  value={templateForm.watch('session_type')}
                  onValueChange={(value) =>
                    templateForm.setValue('session_type', value as WeeklyTemplateFormValues['session_type'])
                  }
                >
                  <SelectTrigger id="template-type" className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bouldering">Bouldering</SelectItem>
                    <SelectItem value="kilterboard">Kilterboard</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="fingerboard">Fingerboard</SelectItem>
                    <SelectItem value="strength">Strength</SelectItem>
                    <SelectItem value="aerobic">Aerobic</SelectItem>
                    <SelectItem value="rest">Rest</SelectItem>
                    <SelectItem value="mobility">Mobility</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="template-duration">Duration (mins)</Label>
                <Input
                  id="template-duration"
                  type="number"
                  className="min-h-[44px]"
                  value={templateForm.watch('duration_mins') ?? ''}
                  onChange={(event) => {
                    const next = event.target.value
                    templateForm.setValue('duration_mins', next.length > 0 ? Number(next) : null)
                  }}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="template-focus">Primary Focus</Label>
                <Input
                  id="template-focus"
                  className="min-h-[44px]"
                  value={templateForm.watch('primary_focus') ?? ''}
                  onChange={(event) =>
                    templateForm.setValue(
                      'primary_focus',
                      event.target.value.length > 0 ? event.target.value : null,
                    )
                  }
                />
              </div>
              <div>
                <Button type="submit" className="min-h-[44px]" disabled={isSavingTemplate}>
                  {isSavingTemplate ? 'Saving template...' : 'Save Template Slot'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
