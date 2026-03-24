# AI Coaching Prompt Strategy

This document explains how the system prompt is built for each Gemini API call, and the reasoning behind the design decisions.

## Why the Prompt Is Rebuilt Every Request

Vercel serverless functions have no persistent memory between invocations. There is no long-running process keeping a conversation in memory.

Every chat request triggers a fresh serverless function execution. To give the AI coach full context, the `contextBuilder.ts` service fetches the current state from Supabase and assembles it into a complete system prompt before calling Gemini:

- **Athlete profile** — loaded from a static config or Supabase
- **Current programme state** — active programme, current mesocycle, current week
- **Recent session history** — last 30 days of `session_logs`
- **Today's readiness check-in** — from `readiness_checkins`
- **Recent chat history** — last 10 messages from `chat_messages`

This approach trades latency (N Supabase queries per request) for correctness. The alternative — caching context in memory — would fail silently when the serverless function is recycled.

## Prompt Structure

The system prompt is assembled in this order. Static sections change rarely; dynamic sections are fetched fresh on every request.

| # | Section | Type | Source |
|---|---|---|---|
| 1 | Role and coaching philosophy | Static | Hardcoded in `promptBuilder.ts` |
| 2 | Athlete profile | Static | Supabase or config (changes rarely) |
| 3 | Current programme state | Dynamic | `programmes`, `mesocycles` tables |
| 4 | Return-to-training protocol | Static | Hardcoded (currently active) |
| 5 | Weekly training structure | Semi-static | `weekly_templates` table |
| 6 | Decision rules | Static | Hardcoded in `promptBuilder.ts` |
| 7 | Onsight-specific coaching notes | Static | Hardcoded in `promptBuilder.ts` |
| 8 | Recent session history (last 30 days) | Dynamic | `session_logs` table |
| 9 | Today's readiness check-in | Dynamic | `readiness_checkins` table |
| 10 | Recent chat history (last 10 messages) | Dynamic | `chat_messages` table |

## Why Decision Rules Are Hardcoded

Safety-critical and injury-management rules are explicitly stated in the prompt rather than left to model discretion.

Examples:
- "Do not recommend hangboard or crimping if finger health score is below 6"
- "Avoid heavy overhead pressing due to left shoulder impingement history"
- "Recommend rest or light movement only if overall fatigue is below 4"

A language model can infer that a shoulder injury history suggests caution with pressing. But "can infer" is not the same as "will reliably infer on every request". For safety-critical rules, explicit instruction beats implicit reasoning.

Hardcoded rules also make the coaching logic auditable and testable: the rules are readable in `promptBuilder.ts`, not buried in model weights.

## Climbing Knowledge Sources

The coaching philosophy and methodology sections of the prompt draw on these established sources:

- **The Self-Coached Climber** — Hague & Hunter: periodisation framework, finger training principles
- **Training for Climbing** — Eric Hörst: strength and power development, energy systems
- **9 out of 10 Climbers** — Dave MacLeod: mental training, footwork, onsight technique
- **Anderson Brothers hangboard methodology** — Minimum Edge Repeaters and Max Hangs protocols
- **General periodisation science** — Issurin (*Block Periodization*), Bompa (*Periodization Training for Sports*)

These are referenced in the prompt to give the model a shared vocabulary with the athlete and to anchor recommendations in established methodology rather than generic fitness advice.
