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
Scan QR code with iPhone camera. Requires **Expo Go** app from App Store.

### Standalone Build (own icon/name)
```bash
cd mobile-app && npx expo run:ios --device
```
Requires Xcode (full app, not just CLI tools) + iPhone connected via USB. Free Apple ID = 7-day app expiry, re-run the same command to refresh. First build will prompt for Apple ID sign-in in Xcode. On iPhone: **Settings > General > VPN & Device Management > [your Apple ID] > Trust** to allow the app to run.

## Auth

Two login methods:
1. **Google Sign-In** — opens OmniAuth flow with `?origin=mobile`, backend redirects to `jarvis://auth?token=JWT`, app intercepts via `WebBrowser.openAuthSessionAsync`
2. **Manual token paste** — copy JWT from web app's network requests

Backend changes for mobile auth are in `backend/app/controllers/google_calendar_auth_controller.rb` — `include JwtAuth` + mobile origin check. No credentials stored in the mobile app; all OAuth happens server-side.

## Architecture

- **Expo SDK 54**, expo-router (file-based routing)
- **React Query** (`@tanstack/react-query`) for data fetching
- **Zustand** for auth state
- **Axios** with `expo-secure-store` for token storage (iOS Keychain)
- **date-fns** for date formatting
- API base: `https://sifxtre.me/api`

## Features

| Tab | Description |
|-----|-------------|
| Transactions | List, create (FAB), edit, filter by month/year/search, recurring status card with quick-add |
| Calendar | Day view, multi-user filter chips, event dedup by `event_uid`, inline title edit via long-press |
| Chat | Messages with image upload (gallery/camera), optimistic rendering, infinite scroll, conversation reset button |
| Budget | Budget vs actual by category with progress bars, month navigation |
| Trends | Yearly summaries with YoY comparison, monthly spending bars, top categories/merchants, merchant search |

## Style Guide

Styles are matched to the mobile web app (`finance-tracker-app`). Key values:
- **Border radius**: 8px for cards/inputs, 6px for buttons (`rounded-md`)
- **Chat bubbles**: 24px radius (`rounded-2xl`), 4px corner cutoff
- **Font sizes**: 14px body text (`text-sm`), 15px merchant names, 12px muted details
- **Colors**: Extracted from web CSS variables into `src/lib/theme.ts`
- **Dark mode**: Full support via `useColorScheme()` + theme colors
- **Tabular numbers**: `fontVariant: ['tabular-nums']` on all currency/amount displays

## Key Files

```
app.json                          — Expo config (scheme: jarvis, bundleId: com.jarvis.finance)
app/_layout.tsx                   — Root layout, auth gate, QueryClientProvider
app/(tabs)/_layout.tsx            — Tab navigator with 5 tabs
app/(tabs)/index.tsx              — Transactions screen (orchestrator)
app/(tabs)/calendar.tsx           — Calendar day view
app/(tabs)/chat.tsx               — Chat with AI
app/(tabs)/budget.tsx             — Budget vs actual
app/(tabs)/trends.tsx             — Spending trends
src/lib/api.ts                    — All API types and functions
src/lib/events.ts                 — EventEmitter for cross-component communication
src/lib/theme.ts                  — Light/dark color schemes from web CSS vars
src/lib/utils.ts                  — formatCurrency, formatDate, month helpers
src/components/LoginScreen.tsx    — Google OAuth + manual token login
src/components/TransactionList.tsx       — Transaction FlatList with FAB
src/components/TransactionEditModal.tsx  — Create/edit transaction modal
src/components/TransactionFilterBar.tsx  — Month/year nav + filter button
src/components/TransactionFilterSheet.tsx — Full filter modal
src/components/RecurringStatusCard.tsx   — Missing recurring transactions with quick-add
```

## Known Issues

- `react-native-web` not installed — web bundler fails when opening localhost:8081 in browser. Ignore; this is iOS-only.
- npm peer dep conflicts with react 19 — use `--legacy-peer-deps` for non-expo packages
- QR code only renders in interactive terminal — `npx expo start` must be run directly, not via background process

## Chat Bot Fixes (deployed)

The chat bot had a loop bug where it would repeat "Reply with the event numbers to add, or say 'all'" endlessly if the user replied with anything other than numbers. Fixed with 4 layers:

1. **Cancel detection** — "stop", "cancel", "nevermind", etc. now immediately clear pending state
2. **30-minute TTL** — stale pending actions auto-expire, so coming back later starts fresh
3. **Better prompts** — selection prompts now mention "cancel" as an escape option
4. **Reset button** — both web and mobile chat have a reset button to manually clear conversation state (`DELETE /chat/thread`)

Backend files changed: `web_chat_message_handler.rb`, `gemini_client.rb`, `chat_helpers/state.rb`, `chat_helpers/event_handlers.rb`, `chat_helpers/transaction_handlers.rb`, `chat_messages_controller.rb`, `routes.rb`

## TODO

- [ ] Build standalone app: plug iPhone in via USB, run `cd mobile-app && npx expo run:ios --device` (Xcode is installed)
- [ ] Replace default icon (`assets/icon.png`) with custom Jarvis icon (1024x1024 PNG)
- [ ] Test Google Sign-In flow end-to-end on device
