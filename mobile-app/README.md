# Jarvis Mobile App

Expo React Native iOS app for Jarvis finance tracker.

## Setup

```bash
cd mobile-app
npm install
```

## Running

### Development (Expo Go)
```bash
npx expo start
```
Scan QR code with iPhone camera. Requires Expo Go app installed.

### Standalone Build (own icon/name)
```bash
npx expo run:ios --device
```
Requires Xcode + iPhone connected via USB. Free Apple ID = 7-day expiry.

## Auth

Two login methods:
1. **Google Sign-In** — uses OmniAuth with `?origin=mobile`, backend redirects to `jarvis://auth?token=JWT`
2. **Manual token paste** — copy JWT from web app

## Architecture

- **Expo SDK 54**, expo-router (file-based routing)
- **React Query** for data fetching
- **Zustand** for auth state
- **Axios** with SecureStore for token storage
- API base: `https://sifxtre.me/api`

## Features

| Tab | Description |
|-----|-------------|
| Transactions | List, create, edit, filter by month/year/search, recurring status card with quick-add |
| Calendar | Day view, multi-user filter chips, event deduplication by `event_uid`, inline title edit |
| Chat | Messages with image upload (gallery/camera), infinite scroll |
| Budget | Budget vs actual by category with progress bars |
| Trends | Yearly summaries, monthly spending, top categories/merchants, merchant search |

## Known Issues

- `react-native-web` not installed — web bundler fails, ignore (iOS-only app)
- `react-native-worklets` required by reanimated — install via `npx expo install`
- npm peer dep conflicts — use `--legacy-peer-deps` for non-expo packages

## Key Files

- `app.json` — Expo config (scheme: `jarvis`, bundleId: `com.jarvis.finance`)
- `src/lib/api.ts` — all API types and functions
- `src/lib/events.ts` — EventEmitter for cross-component communication
- `src/lib/theme.ts` — light/dark color schemes
- `src/components/` — reusable components (LoginScreen, TransactionList, RecurringStatusCard, etc.)
