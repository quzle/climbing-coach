# ADR 002: Google Gemini AI Over OpenAI / Anthropic

## Status

Accepted

## Date

2026-03-24

## Context

The application requires a large-language-model API for coaching intelligence: answering training questions, generating session plans, and interpreting session logs. Three providers were considered: OpenAI (GPT-4o), Anthropic (Claude), and Google (Gemini).

**Budget constraint:** £0/month. This is a personal project with no revenue. Paid tiers are not viable for ongoing operation.

Free tier comparison at time of decision:
- OpenAI: no meaningful free tier for GPT-4 class models
- Anthropic: no free tier
- Google Gemini: 1,500 requests/day, 1,000,000 token context window on free tier via Google AI Studio

## Decision

Use **Google Gemini 2.5 Pro** via the Google AI Studio free tier, accessed through the `@google/generative-ai` SDK.

## Consequences

**Positive:**
- Free tier covers single-user usage comfortably (1,500 req/day)
- 1M token context window allows the full training history, programme state, and recent sessions to be injected into every prompt without chunking or summarisation
- Context window size is a significant coaching quality advantage — the model can reason over months of training data in a single call
- No credit card required for development

**Negative:**
- Rate limits apply — requests beyond 1,500/day are rejected
- Free tier has lower priority than paid tier (possible latency under load — not a concern for single-user)
- Model behaviour is less predictable than a paid, stable API tier

**Upgrade path:** The Gemini client is isolated in `src/services/ai/geminiClient.ts`. Swapping models (e.g. to `gemini-2.5-pro-002` or a paid tier) requires changing a single string constant. Switching providers requires rewriting only `geminiClient.ts` — the rest of the services layer is unaffected.
