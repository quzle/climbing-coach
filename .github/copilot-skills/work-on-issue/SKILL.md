---
name: work-on-issue
description: >
  Use this skill whenever the user says something like "work on issue #N",
  "next issue", "pick up issue", "start on #N", or asks Copilot to implement
  a GitHub issue. Manages the full lifecycle: reads the issue, delegates implementation to a subagent,
  keeps the issue updated with progress comments, and closes it when complete. 
  Always use this skill when a GitHub issue number is
  mentioned in the context of doing work.
---

# Work on Issue

Implements a GitHub issue end-to-end with subagent delegation, issue hygiene, 
and a clear stop-and-ask policy.

## Inputs

- Issue number (from user prompt, e.g. "work on issue #26")
- If no number given, find the lowest-numbered open issue and confirm
  with the user before proceeding

## Workflow

### 1. Read the issue

Use the GitHub MCP tool to fetch the issue. Extract:
- Title
- Full description / acceptance criteria
- Any existing comments for context

Post a comment on the issue:
> 🤖 Starting work on this issue.

### 2. Delegate implementation to a subagent

Hand off to a subagent with the following context:
- The full issue title and body
- The instruction: **"Implement this issue. Run tests after making
  changes. If you are ever uncertain how to proceed, stop and surface
  the question — do not guess."**
- The subagent should NOT post GitHub comments
  — those are handled by the parent agent

Keep the main context clean — the subagent works autonomously and you
receive only its summary when done.

### 3. Handle subagent outcome

**If the subagent completes successfully:**
- Post a completion comment on the issue (see format below)
- Close the issue via MCP or `gh issue close <NUMBER> --repo <REPO>`
- Report back to the user: "Issue #N done. Changes: [summary]."

**If the subagent is uncertain or blocked:**
- Post a blocker comment on the issue
- Surface the question to the user and wait for their answer
- Once answered, resume from step 3 with the additional context

**If tests fail after implementation:**
- Post a comment noting the failure and what was attempted
- Ask the user whether to retry, skip, or abandon

### 4. Stop-and-ask policy

Stop and ask the user (do not proceed) if:
- The issue description is ambiguous about expected behaviour
- The change would affect more than one feature area unexpectedly
- A dependency is missing and needs a decision on how to resolve it
- Tests were passing before and now fail for an unrelated reason

## Issue comment format

**Start comment:**
> 🤖 Starting work on this issue.

**Progress comment (if needed mid-task):**
> 🤖 Working on: [brief description of current step]

**Completion comment:**
> ✅ Done. Changed: `path/to/file.ts`, `path/to/other.ts`
> [One sentence summary of what was implemented]

**Blocker comment:**
> ⚠️ Blocked: [clear description of the question or uncertainty]

**Skipped comment:**
> 🚫 Skipped on user request.

## Notes

- Never merge or push to main — work happens on the current branch
- Do not create new branches — continue on whichever branch is active
- If the user says "skip this issue", set status to **Todo**, close
  with a skipped comment, and stop