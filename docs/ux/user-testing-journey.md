# User Testing Journey

**Purpose:** This document maps the full user journey from account activation to regular training use. It is structured as a testing guide — each stage has observation prompts and a feedback capture table you can fill in during or after a session.

**Scope:** Covers everything from account creation through daily training habits. **Progress reporting / analytics is out of scope** — this feature is not yet designed or built.

**App context:** The UI is intentionally minimal. Testers should be briefed that visual polish is not the point of this phase; we are testing whether the flows are understandable and the interactions do what users expect.

---

## The journey at a glance

```
Invited via email
      ↓
Activate account (one-time)
      ↓
Set up profile — display name, injury areas (one-time)
      ↓
Create training programme via AI wizard (one-time per programme)
      ↓
Configure weekly schedule (one-time per programme)
      ↓
┌─────────────────────────── Daily training loop ──────────────────────────────┐
│                                                                               │
│  Open app → Check in (readiness) → See today's session → Log session         │
│                          ↑                                                    │
│                  (optional) Chat with AI coach at any point                  │
└───────────────────────────────────────────────────────────────────────────────┘
      ↓
Review session history
```

---

## Journey stages

### Stage 0 — Invitation

**What the user is trying to do:** Understand that they've been invited to something, and take the first action.

**What happens:**
- User receives an email from Supabase (generic branding — no app branding yet)
- Email contains an "Accept invite" button
- Clicking it opens the app and activates their account
- User is redirected to the home dashboard

**Things to observe:**

| # | Observation prompt |
|---|---|
| 0.1 | Does the user understand what the invite email is for? |
| 0.2 | Do they hesitate before clicking "Accept invite"? |
| 0.3 | Do they notice the transition from email → app, or does it feel seamless? |
| 0.4 | On landing at the home screen, do they know where they are and what to do next? |

**Known limitations at this stage:**
- The invite email has Supabase default branding, not Climbing Coach branding
- There is no welcome screen or onboarding message after activation
- The home dashboard will be mostly empty — no programme, no sessions, no check-ins yet

**Feedback:**

| Observation | Severity (High / Med / Low) | Notes | Suggested action |
|---|---|---|---|
| | | | |

---

### Stage 1 — Profile setup

**Route:** `/profile`

**What the user is trying to do:** Get oriented in the app, set a display name, and optionally add tracked injury areas.

**What happens:**
- User can set a display name
- User can add injury areas they want to track (e.g. left elbow, fingers)
- Tracked areas appear in the daily readiness check-in and session log

**Things to observe:**

| # | Observation prompt |
|---|---|
| 1.1 | Does the user find the profile page without prompting? |
| 1.2 | Is the purpose of "tracked injury areas" clear from the UI label alone? |
| 1.3 | Does the user understand the difference between "tracked" and "not tracked" areas? |
| 1.4 | Do they add injury areas that are relevant to them, or skip this step? |
| 1.5 | Do they understand that these areas will appear in daily check-ins? |

**Feedback:**

| Observation | Severity | Notes | Suggested action |
|---|---|---|---|
| | | | |

---

### Stage 2 — Programme creation

**Routes:** `/programme` → `/programme/new`

**What the user is trying to do:** Create a structured training programme tailored to their goals using the AI wizard.

**What happens:**
1. User lands on `/programme` — sees an empty state with a prompt to create a programme
2. User navigates to `/programme/new` (the wizard)
3. Fills in a form: goal, start date, duration, focus, current grades, strengths, weaknesses, target event, injuries, additional context
4. Submits — waits ~5 seconds while AI generates mesocycles
5. Reviews the AI-generated plan (list of training blocks with phase types, focus, and dates)
6. Confirms the plan or goes back to adjust inputs

**Things to observe:**

| # | Observation prompt |
|---|---|
| 2.1 | Does the user understand what a "programme" is before starting? |
| 2.2 | Which form fields do they fill in confidently vs. hesitate over? |
| 2.3 | Do they understand what "mesocycles" / "training blocks" are when reviewing the generated plan? |
| 2.4 | Do they feel the AI-generated plan is relevant to the goal they entered? |
| 2.5 | Do they want to edit the generated plan, or is "accept or re-generate" sufficient? |
| 2.6 | How do they react to the 5-second wait during AI generation? |
| 2.7 | Is the "Review your plan" step clear, or does it feel like a step too many before starting? |
| 2.8 | Is the phase terminology (Base, Power Endurance, Climbing Specific, etc.) meaningful to this user? |

**Specific form fields to watch:**
- **Goal** — is a single text field sufficient, or do users want guided prompts?
- **Strengths / weaknesses** — freetext; do users know what level of detail is helpful?
- **Current grades** — optional; do users skip it and does that affect plan quality?

**Feedback:**

| Observation | Severity | Notes | Suggested action |
|---|---|---|---|
| | | | |

---

### Stage 3 — Weekly schedule setup

**Route:** `/programme/[id]/setup-week`

**What the user is trying to do:** Define which days they can train, what types of sessions they want, and optionally lock specific session types to specific days.

**What happens:**
1. After confirming the programme, user is taken straight to the weekly schedule setup
2. User selects available training days (multi-select toggles)
3. Chooses preferred session duration
4. Selects training styles to include (Bouldering, Lead, Fingerboard, Strength, etc.)
5. Optionally assigns/locks specific styles to specific days
6. Submits — AI generates a weekly schedule
7. Reviews schedule on an interactive board — can drag sessions between days or remove them
8. Confirms — planned sessions are generated for the whole mesocycle

**Things to observe:**

| # | Observation prompt |
|---|---|
| 3.1 | Is the purpose of this step clear — what does "setting up a weekly schedule" mean to the user? |
| 3.2 | Do users engage with the day-preference / lock feature, or skip it? |
| 3.3 | Is the interactive schedule board (drag-and-drop) intuitive on mobile? |
| 3.4 | Do they understand that confirming here generates sessions for the entire training block? |
| 3.5 | After confirming, do they know where to find their generated sessions? |
| 3.6 | Does the user understand what "planned sessions" are vs. "logged sessions"? |

**Feedback:**

| Observation | Severity | Notes | Suggested action |
|---|---|---|---|
| | | | |

---

### Stage 4 — Daily check-in (readiness)

**Route:** `/readiness`

**What the user is trying to do:** Report how their body feels before training, so the AI coach can adapt advice accordingly.

**What happens:**
1. User opens the readiness form (from home dashboard or nav)
2. 7-step card wizard — most steps auto-advance after selection:
   - Sleep quality (5-point scale)
   - Body fatigue (5-point scale)
   - Finger health (5-point scale)
   - Injury area health — one rating per tracked area (manual advance)
   - Life stress (5-point scale)
   - Illness (Yes / No)
   - Notes (optional freetext)
3. Submits — warnings are computed and shown (e.g. "High fatigue detected")
4. User can proceed to view today's plan or open the AI coach

**Things to observe:**

| # | Observation prompt |
|---|---|
| 4.1 | Does the user understand why they are being asked these questions? |
| 4.2 | Do the 5-point scale labels feel calibrated correctly? (e.g. "Terrible → Great" for sleep) |
| 4.3 | Do auto-advancing steps feel natural, or do users want to control the pace? |
| 4.4 | Does the user notice and understand the injury area step if they have tracked areas? |
| 4.5 | Do users engage with the notes field, or skip it? |
| 4.6 | Are the warning messages after submission clear and actionable? |
| 4.7 | After submission, do users know what to do next? |
| 4.8 | Does the user feel the check-in is worth doing on a daily basis? |

**Feedback:**

| Observation | Severity | Notes | Suggested action |
|---|---|---|---|
| | | | |

---

### Stage 5 — Finding and starting today's session

**Routes:** `/` (home) → `/session/log`

**What the user is trying to do:** Find out what they should do today and begin the session.

**What happens:**
1. Home dashboard shows "Today's session" card with the planned session type and a "Start session" button
2. Tapping "Start session" opens the session log form pre-filled with the session type (and linked to the planned session)
3. Any active readiness warnings are shown at the top of the home screen

**Things to observe:**

| # | Observation prompt |
|---|---|
| 5.1 | Does the user check the home screen first, or go straight to the Plan tab? |
| 5.2 | Is "Today's session" card prominent enough to be the first thing they see? |
| 5.3 | Do they understand what the displayed session type means (e.g. "Bouldering" vs. "Fingerboard")? |
| 5.4 | Do the readiness warnings influence what they decide to do? |
| 5.5 | If there is no planned session for today, does the empty state make sense? |

**Feedback:**

| Observation | Severity | Notes | Suggested action |
|---|---|---|---|
| | | | |

---

### Stage 6 — Logging a session

**Route:** `/session/log`

**What the user is trying to do:** Record what happened during their training session.

**What happens:**
1. User selects a session type (or it's pre-filled from the planned session)
2. Fills in common fields: date, duration, session quality (1–5), RPE (1–10), notes
3. Fills in type-specific data:
   - **Climbing (Bouldering / Kilterboard / Lead):** Location, individual problems/attempts with grade and result
   - **Fingerboard:** Protocol, sets with hang time, edge size, reps
   - **Strength:** Focus area, exercises with reps and weight
   - **Aerobic:** Activity type, elevation gain
4. Flags any injury areas that were aggravated during the session
5. Submits — session is logged; planned session is marked as completed

**Things to observe:**

| # | Observation prompt |
|---|---|
| 6.1 | Does the user understand what RPE means and how to rate it? |
| 6.2 | How many problems/sets/exercises do they attempt to log? Is the entry process fast enough? |
| 6.3 | Do they use the injury flags, or skip them? |
| 6.4 | Do they use the notes field? |
| 6.5 | Is the distinction between "session quality" and "RPE" clear? |
| 6.6 | For climbing: is logging attempts by grade and result natural, or does it feel like data entry? |
| 6.7 | Does the draft auto-save feel reassuring, or do users not notice it? |
| 6.8 | After logging, do they feel the data they entered is useful / worth logging? |

**Feedback:**

| Observation | Severity | Notes | Suggested action |
|---|---|---|---|
| | | | |

---

### Stage 7 — Interacting with the AI coach

**Route:** `/chat`

**What the user is trying to do:** Get personalised coaching advice — whether about training, recovery, technique, or planning.

**What happens:**
1. User opens the chat interface
2. Can type any message
3. The coach has access to: today's readiness check-in, recent sessions, active programme, upcoming planned sessions, injury areas
4. Responds in formatted markdown (bullet points, bold text, headers where appropriate)
5. Any readiness warnings are surfaced in the coach's response context
6. From the readiness success screen or session log success screen, the user can open chat with a pre-filled message summarising what just happened

**Things to observe:**

| # | Observation prompt |
|---|---|
| 7.1 | What is the user's first instinct when opening the chat — do they know what to ask? |
| 7.2 | Does the coach's response feel contextually aware (i.e. does it reference their actual data)? |
| 7.3 | Is the markdown formatting readable on mobile, or does it feel cluttered? |
| 7.4 | Do users ask about training, recovery, technique — or something else entirely? |
| 7.5 | Do they follow up with more questions, or treat it as a single-query tool? |
| 7.6 | Do they notice / use the pre-filled message links from readiness and session log screens? |
| 7.7 | How does the response quality compare to their expectations of an "AI coach"? |
| 7.8 | Is the chat history useful on return visits, or does it feel stale? |

**Feedback:**

| Observation | Severity | Notes | Suggested action |
|---|---|---|---|
| | | | |

---

### Stage 8 — Returning to the app over time

**Routes:** `/` (home), `/history`, `/programme`

**What the user is trying to do:** Maintain the daily training habit — check in, follow the plan, log sessions.

**What happens:**
- Home dashboard is the primary re-entry point
- Session history (`/history`) gives a reverse-chronological log of all sessions
- Programme view (`/programme`) shows the full training block, mesocycles, and upcoming sessions
- The user can skip a planned session, or start it from the programme view

**Things to observe:**

| # | Observation prompt |
|---|---|
| 8.1 | Does the home dashboard give the user what they need on a return visit without navigating elsewhere? |
| 8.2 | Do they use the history view to review past sessions? |
| 8.3 | Do they understand the mesocycle structure in the programme view? |
| 8.4 | Does the "upcoming sessions" list in the programme view feel useful, or overwhelming? |
| 8.5 | Do users skip sessions, and do they understand what that means for their plan? |
| 8.6 | Over multiple visits, does the app feel like it's building a picture of them as an athlete? |

**Feedback:**

| Observation | Severity | Notes | Suggested action |
|---|---|---|---|
| | | | |

---

## Navigation overview

The bottom navigation bar is the primary wayfinding tool:

| Tab | Route | Purpose |
|-----|-------|---------|
| Home | `/` | Daily hub — readiness status, today's session, last session |
| Log | `/session/log` | Log a new session |
| Chat | `/chat` | AI coach |
| History | `/history` | All past sessions |
| Plan | `/programme` | Training programme, mesocycles, upcoming sessions |
| Profile | `/profile` | Display name, injury areas, password |

**Things to observe (general navigation):**

| # | Observation prompt |
|---|---|
| N.1 | Do users find the tab labels intuitive? ("Log", "Plan", "History" especially) |
| N.2 | Do they use the bottom nav naturally, or hunt for things? |
| N.3 | Is "Log" vs "History" vs "Plan" clear as a distinction? |
| N.4 | Do they ever get lost or not know how to get back to where they were? |

---

## Testing session structure (suggested)

For a 45–60 minute session:

1. **Brief (5 min):** Explain the purpose — testing the app, not the person. Emphasise the MVP/minimal-UI context. Ask them to think aloud.

2. **Activation (5 min):** User activates their account from the invite email. Observe without help.

3. **Profile setup (5 min):** Ask: "Set yourself up in the app." Observe whether they find and use the profile page.

4. **Programme creation (10–15 min):** Ask: "Create a training programme that works for you." Do not guide form fields unless they get completely stuck.

5. **Daily loop (15–20 min):** Ask: "It's a training day. Go through what you'd do." Let them find the check-in, today's session, and the log form.

6. **AI coach (5–10 min):** Ask: "Ask the coach something about your training." Note what they ask and how they react to the response.

7. **Debrief (10 min):** Open questions — what did they find confusing, what felt good, what's missing, would they use this?

---

## Feedback severity guide

| Severity | Definition |
|----------|-----------|
| **High** | User could not complete the task without help, or got significantly confused |
| **Med** | User hesitated, took a wrong path, or expressed confusion but recovered |
| **Low** | Minor friction, unclear language, or aesthetic preference |

---

## Out of scope

The following are **not** part of this testing phase:

- Progress reporting and analytics (not designed or built)
- Mesocycle editing or plan modification after creation
- Admin / invite sending UI (invites are sent via Supabase dashboard for now)

---

## Reference

For the technical flow detail behind each stage, see the companion documents in this directory:

| Stage | Detail doc |
|-------|-----------|
| Account activation | [00-account-creation.md](./00-account-creation.md) |
| First-time experience | [01-first-time-setup.md](./01-first-time-setup.md) |
| Daily training loop | [02-daily-training-loop.md](./02-daily-training-loop.md) |
| Programme setup | [03-programme-setup.md](./03-programme-setup.md) |
| Session planning | [04-session-planning.md](./04-session-planning.md) |
| Injury management | [05-injury-management.md](./05-injury-management.md) |
