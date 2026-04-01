# Flow 00: Account Creation

## Overview

Climbing Coach uses an invite-only signup model. There is no public registration page. A superuser sends an invite via Supabase, the invited user clicks the link in their email, and the application activates their account on arrival at the auth callback. The user then accesses the app using email and password on all subsequent visits.

This flow has two actors: the **superuser** who initiates the invite, and the **invited user** who completes it. The two sides are independent and asynchronous.

The invite magic link establishes an authenticated session but does not set a password. Password creation is handled via Supabase's password reset flow: the user clicks "Forgot password" on `/auth/login` and follows the emailed link to set a password. This is the accepted approach for MVP — no in-app password setup screen is planned.

At the time of writing, the invite must be sent from the Supabase dashboard directly. The in-app invite UI (`DEV-2`) and `POST /api/invites` route (`API-0`) are not yet implemented.

### Required Supabase configuration

Supabase distinguishes between two URL settings:

- **Site URL** — the default redirect destination when no explicit `redirectTo` is provided. This should remain the app root (e.g. `http://localhost:3000`). It should not be set to a callback path.
- **Allowed Redirect URLs** — an explicit allowlist of permitted `redirectTo` destinations. Any URL passed as `redirectTo` (including in invite links and API calls) must appear here.

The invite flow must redirect to `/auth/confirm` (see `AUTH-8`), not `/auth/callback`. Add the following to the **Allowed Redirect URLs** list in **Authentication > URL Configuration** (`MANUAL-1`):

| Environment | URL to add |
|---|---|
| Local development | `http://localhost:3000/auth/confirm` |
| Staging / production | `https://<your-deployed-domain>/auth/confirm` |

Because the Supabase dashboard does not expose a per-invite redirect field, the invite email template must also be updated to route to `/auth/confirm` (`MANUAL-2`). Once `API-0` is implemented, `inviteUserByEmail` will pass `options.redirectTo` explicitly.

### Why `/auth/confirm` and not `/auth/callback`

The existing `/auth/callback` route uses `exchangeCodeForSession(code)`, which handles OAuth PKCE codes delivered as `?code=` query parameters. Supabase's invite (and password recovery) flow uses a different mechanism: it delivers a `?token_hash=...&type=invite` pair and requires `verifyOtp({ token_hash, type })`. These are distinct server-side calls and must be handled by separate routes. `AUTH-8` adds the `/auth/confirm` route for OTP-based flows.

---

## Sequence diagram

```mermaid
sequenceDiagram
    actor Superuser
    actor User
    participant App
    participant API
    participant Supabase

    Note over Superuser,Supabase: Invite dispatch (currently: Supabase dashboard only)
    Superuser->>Supabase: inviteUserByEmail(email)
    Supabase-->>Superuser: OK
    Supabase-->>User: Invite email — link contains token_hash and type=invite

    Note over User,Supabase: Account activation
    User->>App: Clicks "Accept invite" → /auth/confirm?token_hash=...&type=invite
    App->>Supabase: verifyOtp({ token_hash, type: 'invite' })
    Supabase-->>App: Session (access token + refresh token set in cookies)

    App->>API: finalizeInvitedUserProfile(userId, email)
    API->>Supabase: UPSERT profiles { id, email, role: 'user', invite_status: 'active' }
    Supabase-->>API: Profile row
    API-->>App: OK

    App-->>User: Redirect to /
    Note over User,App: Session is active. User should set a password<br/>before the session expires via "Forgot password" on /auth/login.

    Note over User,App: On all subsequent visits
    User->>App: Navigates to any protected route
    App-->>User: Middleware redirects to /auth/login
    User->>App: Clicks "Forgot password", enters email
    App->>Supabase: resetPasswordForEmail(email)
    Supabase-->>User: Password reset email
    User->>Supabase: Clicks reset link, sets password
    Supabase-->>User: Confirmation
    Note over User,App: User now has a password and logs in normally on future visits
    User->>App: Submits email + password at /auth/login
    App->>Supabase: signInWithPassword(email, password)
    Supabase-->>App: Session
    App-->>User: Redirect to /
```

---

## Journey map

| Stage | User action | System response | Friction / gap |
|---|---|---|---|
| **Receive invite** | Opens email from Supabase | Generic Supabase-branded invite email with an "Accept invite" button | Email is sent from Supabase's default address with Supabase branding. There is no app-specific copy, no mention of what Climbing Coach is, and no indication of who sent the invite. |
| **Click invite link** | Clicks "Accept invite" | Browser opens `/auth/confirm?token_hash=...&type=invite` | User has no visibility of what is happening. No loading state is shown during the confirmation. |
| **Session established** | — (automatic) | `verifyOtp` runs; cookies are set; profile row is upserted | If verification fails the user is redirected to `/auth/login?error=confirm_failed` with no explanation of what went wrong or what to do next. |
| **Land on home** | Redirected to `/` | Home dashboard renders with empty state | The user has an active session but no password set. There is no prompt directing them to set a password before the session expires. A superuser should advise them to use "Forgot password" on the login page before logging out. |
| **Set password** | Clicks "Forgot password" on `/auth/login`, enters email | Supabase sends a password reset email | The "Forgot password" link is not yet present on the login page — this step requires the standard Supabase reset email flow to be surfaced in the UI. |
| **Return visit** | Opens app after session has expired, logs in with email + password | Middleware redirects to `/auth/login`; user signs in normally | Normal login flow once a password has been set. |

---

## Gap summary

### Accepted / by design
- **Password setup via Supabase reset flow.** The invite magic link does not set a password. Users set their password via "Forgot password" on `/auth/login` before their first session expires. No in-app password setup screen is planned for MVP.

### Resolved
- **`/auth/confirm` OTP route (`AUTH-8`).** Implemented with support for invite-type (profile finalization + redirect) and recovery-type (redirect to change-password page) flows. Handles safe `next` parameter validation and structured error logging.

### Open
- **No in-app invite sending.** Invites must currently be sent directly from the Supabase dashboard. The `/dev` invite UI (`DEV-2`) and `POST /api/invites` (`API-0`) are not yet built.
- **No "Forgot password" link on the login page.** The password reset entry point does not yet exist in the login UI. Users cannot self-serve into the reset flow without knowing the URL directly.
- **No prompt to set a password after first login.** The user lands on the home screen with no guidance that they need to set a password before their session expires.
- **Generic invite email.** The email is sent with Supabase default branding and copy. Customisation requires a Supabase Pro plan or custom SMTP configuration.
- **Silent confirmation failures.** If `verifyOtp` or profile finalization fails, the user is redirected to `/auth/login?error=confirm_failed` with no explanation in the UI.
- **No logout surface.** Once logged in, the user has no way to log out. `CLIENT-2` (logout action) and `CLIENT-3` (user indicator) are pending.
