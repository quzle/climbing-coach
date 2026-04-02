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

- One issue number (from user prompt, e.g. "work on issue #26")
- Or multiple issue numbers in one prompt (e.g. "work on #26, #27, #28")
- If no number given, find the lowest-numbered open issue and confirm
  with the user before proceeding

## Workflow

### 0. Normalize issue list and execution mode

- If the user requests multiple issues in one prompt, build an ordered list exactly as requested.
- Execute issues strictly one-by-one in that order.
- Do not parallelize issue implementation.
- Do not batch completion across issues.
- For each issue, complete the full lifecycle (implement -> test -> docs update -> commit -> comment -> close) before starting the next issue.

Per-issue completion gate (mandatory before moving to next issue):
1. Relevant code and tests for that issue are complete.
2. At least one relevant `docs/` file is updated in the same unit of work.
3. Changes for that issue are committed with a dedicated commit.
4. Completion comment is posted on that issue.
5. That issue is closed.

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
- Before posting completion, ensure relevant documentation under `docs/` is updated for the implemented change.
- Do not treat the issue as complete until at least one relevant `docs/` file is edited in the same unit of work.
- If no clear doc target is obvious, stop and ask the user which `docs/` file should be updated.
- Create a dedicated commit for this issue before posting completion.
- Post a completion comment on the issue (see format below)
- Close the issue via MCP or `gh issue close <NUMBER> --repo <REPO>`
- Report back to the user: "Issue #N done. Changes: [summary]."
- If there are remaining issues in the same user request, continue to the next issue only after this issue is committed and closed.

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
> Docs updated: `docs/path/to/doc.md`
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
- When multiple issues are requested together, use one commit per issue (no shared commit spanning multiple issues).