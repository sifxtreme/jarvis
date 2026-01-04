# Google Auth (ID Token + Session)
Date: 2026-01-02

## Short Spec
- Frontend uses Google Sign-In.
- Backend verifies Google ID token and issues a session cookie.
- Existing endpoints accept session or legacy header (legacy kept for now).
- New endpoints can be Google-only by inheriting GoogleAuthController.

## Setup
- Google OAuth client:
  - Authorized JS origins: https://finances.sifxtre.me
  - Redirect URI: https://sifxtre.me/api/auth/google_oauth2/callback
- Env:
  - GOOGLE_OAUTH_CLIENT_ID
  - GOOGLE_OAUTH_CLIENT_SECRET
  - GOOGLE_AUTH_ALLOWED_EMAILS (fallback allowlist if no users exist)
  - FRONTEND_URL=https://finances.sifxtre.me
- Users allowlist:
  - Stored in users table (active=true), fallback to `GOOGLE_AUTH_ALLOWED_EMAILS` if no users exist.

## Decisions
- HTTP-only cookie session to avoid hourly ID-token reauth (no persistence unless `expire_after` is added).
- Allowlist stored in DB for future calendar sync.
- Legacy auth left in place for existing endpoints.

## Frontend Configuration

- Authorized JS origins:
  - https://finances.sifxtre.me
  - http://localhost:3001 (dev)
- Env:
  - VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id

## Client Usage

Send the Google ID token in the `Authorization` header:

```
Authorization: Bearer <id_token>
```

## Session Cookie

- `POST /auth/session` with `id_token` sets `session[:user_email]` (cookie store).
- Cookie store is client-side (no Redis) and is a session cookie (expires on browser close).

## Auth Matrix
### Global mechanisms
- **Session cookie**: `session[:user_email]` set by `SessionController#create`.
- **Google ID token (Bearer)**: `Authorization: Bearer <id_token>`.
- **Legacy header**: `Authorization == ENV['JARVIS_RAILS_PASSWORD']`.

### Controllers
- `ApplicationController` (default API controllers):
  - Accepts **session**, **Google Bearer**, or **legacy header**.
  - Used by: `CalendarController`, `BudgetsController`, `FinancialTransactionsController`, `TellerController`, `HomeController`.
- `GoogleAuthController`:
  - **Bearer-only** (Google ID token required).
  - Use this when you want Google token auth without session fallback.
- `SessionController`:
  - `POST /auth/session` takes Google ID token and sets session cookie.
  - `GET /auth/session` verifies session.
  - `DELETE /auth/session` clears session.
- `GoogleCalendarAuthController`:
  - OAuth callback (OmniAuth) that stores `google_refresh_token`.
  - Redirect-only; not used for API auth.
- `WebhookController`:
  - No app auth; uses provider signatures instead.
  - `SlackEventsController` verifies Slack signing secret.

## Next Steps
- Add admin UI to manage allowed users.
