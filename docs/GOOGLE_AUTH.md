# Google Auth (ID Token) for API Access

## Overview

- Existing endpoints: accept **legacy header** or **Google ID token**.
- New endpoints: should inherit `GoogleAuthController` and require **Google ID token only**.
- Allowed emails: `asif.h.ahmed@gmail.com`, `hsayyeda@gmail.com` (configurable via env).
- Frontend uses Google Sign-In only (no legacy password).

## Required Environment Variables

```
GOOGLE_OAUTH_CLIENT_ID=your_google_oauth_client_id
GOOGLE_AUTH_ALLOWED_EMAILS=asif.h.ahmed@gmail.com,hsayyeda@gmail.com
GOOGLE_OAUTH_CLIENT_SECRET=your_google_oauth_client_secret
FRONTEND_URL=https://finances.sifxtre.me
```

## Frontend Configuration

- Create a Google OAuth Client ID (Web) for the frontend.
- Authorized JavaScript origins:
  - https://sifxtre.me
  - http://localhost:3001 (dev)
- Set in frontend env:

```
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

## User Allowlist (DB)

Add allowed users to the `users` table:

```ruby
User.create!(email: "asif.h.ahmed@gmail.com", password_hash: "unused")
User.create!(email: "hsayyeda@gmail.com", password_hash: "unused")
```

## Client Usage

Send the Google ID token in the `Authorization` header:

```
Authorization: Bearer <id_token>
```

## Controller Usage

- Existing controllers can keep inheriting `ApplicationController`.
- New endpoints should inherit `GoogleAuthController`:

```ruby
class CalendarEventsController < GoogleAuthController
  def index
    # ...
  end
end
```

## Calendar OAuth (Option A)

1. User signs in on the frontend (Google Sign-In).
2. Frontend redirects to `/auth/google_oauth2`.
3. User completes consent for Calendar scope.
4. Callback stores refresh token in `users.google_refresh_token`.

Authorized redirect URI (in Google Cloud OAuth client):
```
https://sifxtre.me/api/auth/google_oauth2/callback
```

Calendar scope: `https://www.googleapis.com/auth/calendar`
