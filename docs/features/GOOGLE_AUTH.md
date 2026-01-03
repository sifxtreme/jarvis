# Google Auth (ID Token + Session)
Date: 2026-01-02

## Short Spec
- Frontend uses Google Sign-In.
- Backend verifies Google ID token and issues a long-lived session cookie.
- Existing endpoints accept session or legacy header (legacy kept for now).
- New endpoints can be Google-only by inheriting GoogleAuthController.

## Setup
- Google OAuth client:
  - Authorized JS origins: https://finances.sifxtre.me
  - Redirect URI: https://sifxtre.me/api/auth/google_oauth2/callback
- Env:
  - GOOGLE_OAUTH_CLIENT_ID
  - GOOGLE_OAUTH_CLIENT_SECRET
  - FRONTEND_URL=https://finances.sifxtre.me
- Users allowlist:
  - Stored in users table (active=true).

## Decisions
- HTTP-only cookie session to avoid hourly ID-token reauth.
- Allowlist stored in DB for future calendar sync.
- Legacy auth left in place for existing endpoints.

## Next Steps
- Add admin UI to manage allowed users.
