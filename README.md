# Climbing Coach — AI Training Assistant

## Overview

An AI-powered climbing training assistant for an experienced boulderer and multipitch sport climber targeting 7a–7b onsight on limestone and granite. Built with Next.js 14, Supabase (Postgres), and Google Gemini AI. Single-user application deployed on Vercel.

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
│   ├── charts/            → Recharts progress visualisations
│   ├── layout/            → Navigation, page shells, headers
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
4. Run the database schema: see `docs/architecture/database.md`
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

| Phase | Scope |
|---|---|
| **Phase 1** (current) | Foundation: logging, readiness, AI chat |
| **Phase 2** | Programme builder, AI session generation, planned vs actual comparison |
| **Phase 3** | Dashboard, charts, progress intelligence, block review reports |
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
