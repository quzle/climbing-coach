# Components

This document describes the component structure and conventions for the Climbing Coach application.

## Structure and Rules

### `components/ui/`

shadcn/ui auto-generated components built on Radix UI primitives.

**NEVER edit these files manually.** They are overwritten on every `npx shadcn@latest add` update. Any customisation made directly to these files will be lost.

To add a new component:
```bash
npx shadcn@latest add [component-name]
```

To update an existing component:
```bash
npx shadcn@latest add [component-name] --overwrite
```

### `components/forms/`

Application-specific form components. All forms use React Hook Form with a Zod resolver.

| File | Description |
|---|---|
| `ReadinessForm.tsx` | Daily check-in form — overall fatigue, sleep, motivation, finger health, shoulder health. Mobile-first. |
| `SessionLogForm.tsx` | Dynamic session logger — form fields adapt to `session_type` (bouldering, fingerboard, strength, aerobic) |
| `OnboardingForm.tsx` | Initial baseline data entry for first-time setup (Phase 1) |

### `components/charts/` _(Phase 3)_

Data visualisation components built with Recharts.

| File | Description |
|---|---|
| `GradeProgressChart.tsx` | Bouldering and lead grade progression over time |
| `TrainingLoadChart.tsx` | Weekly training volume and load trend |
| `FingerLoadChart.tsx` | Cumulative finger load with fatigue threshold bands |
| `ReadinessTrendChart.tsx` | Readiness scores over time, overlaid with session density |

### `components/layout/`

Page structure and navigation components.

| File | Description |
|---|---|
| `BottomNav.tsx` | Fixed mobile navigation bar — primary navigation for the app |

### `components/chat/`

AI coach chat interface.

| File | Description |
|---|---|
| `CoachChat.tsx` | Full chat UI: message list, input, send button, loading state |

## Conventions

- **Mobile-first:** Write Tailwind classes for mobile by default; use `md:` and `lg:` breakpoints for larger screens.
- **Touch targets:** All interactive elements (buttons, links, inputs) must have a minimum touch target of 44×44px.
- **Forms:** All form components use React Hook Form (`useForm`) with a Zod resolver (`@hookform/resolvers/zod`). Never manage form state with `useState`.
- **Imports:** Import shadcn components from `@/components/ui/`, not directly from `@radix-ui/*`.
- **Naming:** Component files use PascalCase (`SessionLogForm.tsx`). One component per file.
