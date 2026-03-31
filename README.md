# Climbing Coach — AI Training Assistant

## Overview

An AI-powered climbing training assistant for an experienced boulderer and multipitch sport climber targeting 7a–7b onsight on limestone and granite. Built with Next.js 14, Supabase (Postgres), and Google Gemini AI. Deployed on Vercel. Multi-user migration in progress — see `docs/architecture/multi-user-migration-plan.md`.

## Architecture

Modular monolith: Next.js frontend + API routes hosted on Vercel, Supabase Postgres as the single source of truth, Gemini AI for coaching intelligence. No microservices — deliberate choice documented in `docs/architecture/decisions/`.

## Project Structure

```
src/
├── app/                   → Next.js App Router: pages and API routes
│   └── api/               → Server-side API endpoints (thin, call services only)
├── components/            → React UI components
│   ├── ui/                → shadcn auto-generated (never edit manually)
│   ├── forms/             → Session log, readiness, programme builder forms
│   ├── layout/            → Navigation, page shells, headers
│   ├── programme/         → Programme builder editor and session planner UI
│   └── chat/              → AI coach chat interface
├── services/              → All business logic (see src/services/README.md)
│   ├── ai/                → Gemini client, prompt builder, session generator
│   ├── data/              → Repository functions — all DB queries live here
│   └── training/          → Climbing-specific logic: load, periodisation
├── lib/                   → Shared utilities: Supabase clients, types, test utils
├── hooks/                 → Custom React hooks
├── types/                 → Shared TypeScript type definitions
└── __mocks__/             → Jest mocks for static files and CSS
```

## Tech Stack

| Technology | Purpose | Notes |
|---|---|---|
| Next.js 14 | Framework, routing, API routes | App Router, deployed on Vercel |
| TypeScript (strict) | Type safety | `strict: true` + additional checks enabled |
| Tailwind CSS | Styling | v4, utility-first |
| shadcn/ui (Radix) | Accessible UI primitives | Auto-generated in `src/components/ui` — do not edit |
| Supabase | Postgres database + Auth | Single source of truth |
| Google Gemini AI | Coaching intelligence | Via `@google/generative-ai`, free tier |
| Recharts | Progress charts and visualisations | Phase 3 |
| Zod | Schema validation | API boundaries and form schemas |
| React Hook Form | Form state management | Used with `@hookform/resolvers` + Zod |
| Jest | Test runner | Configured with `ts-jest` |
| React Testing Library | Component testing | Custom render in `src/lib/test-utils.tsx` |
| Prettier | Code formatting | `prettier-plugin-tailwindcss` for class sorting |
| ESLint | Linting | `eslint-config-next` + `eslint-config-prettier` |

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env.local` and fill in all values
   (see `.env.example` for where to obtain each key):
   ```bash
   cp .env.example .env.local
   ```
4. Apply the database schema using the Supabase CLI:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   See `docs/architecture/database.md` and `supabase/migrations/` for schema details.
5. Start the development server:
   ```bash
   npm run dev
   ```
6. Open [http://localhost:3000](http://localhost:3000)

## Development Guidelines

- **Formatting:** Prettier — run `npm run format` before committing
- **Linting:** ESLint — run `npm run lint` to check for issues
- **Testing:** Jest + RTL — run `npm test` before every commit
- **Commits:** Conventional commits (`feat/fix/docs/test/chore`)
- **Architecture rules:** see `.github/copilot-instructions.md`
- **New architectural decisions:** add an ADR to `docs/architecture/decisions/`

## Environment Variables

| Variable | Description | Required | Where to get it |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous (public) key | Yes | Supabase Dashboard → Project Settings → API → anon/public |
| `SUPABASE_SECRET_KEY` | Supabase service role key — server only, never expose to browser | Yes | Supabase Dashboard → Project Settings → API → service_role |
| `GEMINI_API_KEY` | Google Gemini API key | Yes | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `NEXT_PUBLIC_APP_URL` | Public base URL of this app | Yes | `http://localhost:3000` locally; production domain on Vercel |

## Deployment

Deployed automatically to Vercel on every push to `main`. Environment variables must be configured in the Vercel project dashboard. See `docs/architecture/overview.md` for full deployment notes.

## Phase Roadmap

| Phase | Scope | Status |
|---|---|---|
| **Phase 1** | Foundation: session logging, readiness check-ins, AI coach chat, training history | Complete |
| **Phase 2** | Programme builder, AI session generation, planned vs actual comparison, flexible injury tracking (ADR 004) | Complete |
| **Phase 3** | Dashboard, progress charts, block review AI reports | Planned |

### What's implemented

**Phase 1 — Foundation**
- Home dashboard with readiness summary, last session card, and quick-action navigation
- AI coach chat powered by Gemini 2.5 Pro with full training context, markdown rendering, and reset confirmation flow
- Session logging (bouldering, kilterboard, lead, fingerboard, strength, aerobic, mobility) with structured JSONB data capture
- Daily readiness check-ins (fatigue, sleep, motivation, body-part health)
- Training history view

**Phase 2 — Programme Builder**
- AI programme creation wizard: describe your goal → Gemini generates a full periodised plan (mesocycle blocks with objectives) → review and confirm in one flow
- Per-mesocycle weekly schedule setup: tap-to-place session board with day preferences and lock mechanic, AI-suggested slot placement via `generate-weekly`
- Planned sessions auto-created for the full mesocycle immediately after weekly setup (no AI calls at creation time — fast)
- Lazy AI session plan generation: Gemini is called only when the user taps "▸ Plan" on an upcoming session; context is maximally fresh at that point; result is cached to avoid redundant calls
- Session plan prefill: tapping "Start session" on a planned session pre-populates the log form with the AI-generated plan
- Load-more on the programme page: default view shows 7-day window; "Load all sessions" fetches the full mesocycle
- Dynamic programme context injected into AI coach prompt
- Flexible injury area tracking (ADR 004): profile page to add/archive tracked areas, dynamic readiness form fields, dynamic AI context rules — replacing the previous hard-coded shoulder logic
