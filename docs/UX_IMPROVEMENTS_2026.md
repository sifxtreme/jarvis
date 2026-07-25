# UX Improvements for Jarvis Finance Tracker
**Date:** 2026-04-26  
**Owner:** Frontend Team  
**Status:** Backlog  
**Version:** 1.0

## TL;DR

The Jarvis Finance Tracker has strong fundamentals but lacks several key user experience patterns that would reduce friction in day-to-day use. Six high-impact improvements stand out: enabling clickable transaction rows for faster editing, implementing empty state messaging for clarity, adding active filter badges to highlight applied filters, implementing optimistic updates for snappier interactions, persisting panel width preferences, and unifying stats views for better data exploration. These improvements address both desktop and mobile pain points, particularly iOS Safari constraints. Estimated effort: 4–6 weeks for full implementation; quick wins (empty states, filter badges) achievable in 1–2 weeks.

---

## Quick Wins (1–2 weeks)

### Empty State Components
**Effort:** 2–3 days | **Impact:** High clarity  
The transaction table currently renders no visual feedback when filters return zero results, leaving users wondering if data exists or if the app is broken. Design and implement two `EmptyState` components:
1. **FilteredEmptyState** (triggered when `transactions.length === 0` and filters are applied)  
2. **DefaultEmptyState** (triggered when `transactions.length === 0` and no filters are applied, e.g., new account)

Each should include an icon, headline, description, and optional call-to-action. Place rendering logic in `TransactionTable.tsx` before the map loop on lines 690–914.

### Active Filter Badge on Mobile
**Effort:** 1–2 days | **Impact:** Medium clarity  
The mobile filter button (`TransactionsPage.tsx`, line 109–113) currently offers no visual indication of applied filters. Add a small badge (e.g., count of active filters) to the button. Logic: count non-default filters (year, month, query, show_hidden, show_needs_review). Example: if year ≠ current year, month ≠ current month, or query is non-empty, increment count.

---

## Detailed Improvements

### 1. Clickable Transaction Rows for Inline Editing
**Priority:** High | **Effort:** 3–5 days | **Mobile-friendly:** Yes  
**Files:** `TransactionTable.tsx` (lines 690–914, 803–910)

**Current state:**  
Transactions display in a table (desktop) or card view (mobile) with action buttons (edit, hide, review, etc.) in a side menu. Users must click the edit icon to trigger inline editing. This requires precise clicking on a small icon rather than clicking the broader row.

**Desired state:**  
Clicking anywhere on a transaction row (except action buttons) should enter edit mode for the first editable field. Action buttons remain click-able via `e.stopPropagation()` to prevent row-level handlers from firing.

**Implementation notes:**
- Add `onClick` handler to each row (TableRow, CardRow) that triggers edit mode on a safe field (e.g., description).
- Preserve `e.stopPropagation()` on action buttons (lines 803–910) so they don't trigger row-level edit.
- For mobile cards, clicking the card body should also trigger edit mode; tapping action buttons should still work.
- Consider keyboard support: pressing Enter or Space on a focused row should also enter edit mode.

**iOS Safari note:** Ensure tap targets are ≥44×44 px; test on Safari 17+.

---

### 2. Empty State Components
**Priority:** High | **Effort:** 2–3 days | **Mobile-friendly:** Yes  
**Files:** `TransactionTable.tsx` (lines 511–517, 690–1111)

**Current state:**  
When a filter results in zero transactions, the table body remains silent. Users see neither a loading spinner nor a message explaining why. The component only renders a loading state (line 511–517) and then either renders rows or nothing.

**Desired state:**  
When `transactions.length === 0`, display a contextual empty state:
- **Filtered empty:** "No transactions match your filters. Try adjusting your date range or removing search terms."
- **Default empty:** "No transactions yet. Start by adding your first transaction."

**Implementation notes:**
- Create a reusable `<EmptyState />` component accepting `variant` (filtered | default), `icon`, `title`, `description`, and optional `action`.
- Insert rendering branch in `TransactionTable.tsx` before the map loop: `if (!transactions.length) return <EmptyState variant={filters applied ? 'filtered' : 'default'} />`.
- On mobile, render in the card view area (lines 920–1111).

---

### 3. Active Filter Badge on Mobile Filter Button
**Priority:** Medium | **Effort:** 1–2 days | **Mobile-friendly:** Yes  
**Files:** `TransactionsPage.tsx` (lines 107–124)

**Current state:**  
The mobile filter button has no visual indicator of active filters. Users must open the sheet to see what's currently applied.

**Desired state:**  
A badge (e.g., red dot or count) appears on the filter button when one or more non-default filters are active.

**Implementation notes:**
- Compute `activeFilterCount` from `filters`: count year (if ≠ currentYear), month (if ≠ currentMonth), query (if non-empty), show_hidden, show_needs_review.
- Render a small badge component (e.g., Radix UI `Badge`) overlaid on the filter button icon.
- Update badge reactively as filter state changes.

---

### 4. Optimistic Updates for Mutations
**Priority:** Medium | **Effort:** 3–4 days | **Mobile-friendly:** Yes  
**Files:** `api.ts` (useMutation call sites, not yet fully enumerated)

**Current state:**  
Inline edits (hide, mark as reviewed, categorize) likely send mutations to the server and wait for confirmation before updating the UI, creating lag on slower connections.

**Desired state:**  
Safe mutations (e.g., toggling hidden flag, marking reviewed) update the UI immediately and roll back on error. Unsafe mutations (e.g., deleting, splitting) should still wait for server confirmation to avoid data loss.

**Implementation notes:**
- Identify all useMutation sites in `api.ts`.
- For safe mutations, implement optimistic updates using React Query's `onMutate` and `onError` callbacks.
- Example: when hiding a transaction, remove it from the local `transactions` array immediately, then revert if the mutation fails.
- Display a toast notification on error so users know the action was rolled back.

---

### 5. Persist Right Panel Width Preference
**Priority:** Medium | **Effort:** 1–2 days | **Mobile-friendly:** No (desktop only)  
**Files:** `TransactionsPage.tsx` (lines 23, 187–206)

**Current state:**  
The right panel width is initialized to 425px (`line 23: const [rightPanelWidth, setRightPanelWidth] = useState(425);`) and reset to this value on every page refresh. Users must resize the panel to their preferred width on each visit.

**Desired state:**  
Panel width preference persists across sessions using localStorage.

**Implementation notes:**
- Replace `useState(425)` with a custom hook like `useLocalStorageState('rightPanelWidth', 425)`, or implement useEffect that reads/writes to localStorage on change.
- Ensure clamping logic remains (200–maxWidth, lines 196–197).
- Test on mobile to ensure no unwanted persistence of values that don't apply in smaller viewports.

---

### 6. Unified All-Time Stats View
**Priority:** Low | **Effort:** 1–2 days | **Mobile-friendly:** Yes  
**Files:** `TransactionStats.tsx` (lines 140, 227–232), `TransactionsPage.tsx` (lines 184–236)

**Current state:**  
`TransactionStats.tsx` only renders when both `year` and `month` filters are set. If a user clears these filters (e.g., to see overall account statistics), the stats panel disappears entirely. The component checks `!!filters?.year && !!filters?.month` before rendering (TransactionsPage.tsx, lines 184–236, 227–232).

**Desired state:**  
Stats panel always renders. When month/year filters are cleared, display "All Time" statistics with cumulative income, spending, and category breakdown across the account's entire history.

**Implementation notes:**
- Modify `TransactionStats.tsx` to handle the case where `year` and `month` are undefined.
- When undefined, fetch (or compute from the transactions list if available) all-time aggregates.
- Change the title from "Monthly Summary" (line 140) to "All Time Summary" when filters are cleared.
- Ensure the API endpoint (`getBudgets`) can return budget constraints for an all-time view, or adjust the stats display to omit budget comparisons when viewing all-time data.

---

## Mobile & iOS Safari Considerations

### Tap Target Sizing
Several interactive elements are below the recommended 44×44 px minimum (e.g., action button icons at 16×16 px). While these are adequate on Android, iOS Safari users report difficulty tapping them. Increase padding around icons or implement larger touch targets with transparent hit zones.

### Input Mode and Keyboard Behavior
Inline edits use HTML `<input>` elements without `inputMode` hints (e.g., `inputMode="decimal"` for amount fields). On iOS Safari, this triggers the default keyboard, not the numeric keypad. Add `inputMode` to numeric fields to improve UX.

### Viewport Height Clipping
The mobile budget sheet uses `h-[85vh]` (TransactionsPage.tsx, line 135), which clips content on iOS Safari when the address bar is visible. Use `max-h-[100dvh]` (dynamic viewport height) instead, or allow scrolling.

### Missing Pull-to-Refresh and Swipe Gestures
iOS users expect pull-to-refresh to reload data. Consider adding a pull-to-refresh gesture handler. Similarly, swipe-left for actions (e.g., hide, review) on card rows would feel native on iOS.

---

## Reconciliation with Old UX Improvements Doc

| Old Doc Item | Status | File:Line Evidence | Notes |
|---|---|---|---|
| Toast notifications for confirmations | DONE | `Sonner` imported in package.json; call sites TBD | Framework already integrated; needs wire-up in mutation handlers. |
| Navigation header with back buttons | STALE | N/A | Not part of current Transactions page scope; may be out-of-scope for this backlog. |
| Empty states for zero-result filters | REAL | TransactionTable.tsx (511–517, 690–1111) | No empty state component currently; rows simply don't render when `transactions.length === 0`. |
| Active filter badge on mobile | REAL | TransactionsPage.tsx (107–113) | Filter button has no badge; badge logic not implemented. |
| Clickable rows for inline editing | REAL | TransactionTable.tsx (690–914, 803–910) | Rows lack `onClick` handlers; only action buttons are clickable. Keyboard support absent. |
| Optimistic updates for mutations | REAL | api.ts (not fully audited) | useMutation call sites need review; no `onMutate` callbacks observed. |
| Right panel width persistence | REAL | TransactionsPage.tsx (line 23) | `useState(425)` resets on refresh; no localStorage integration. |
| All-time stats view | REAL | TransactionStats.tsx (140), TransactionsPage.tsx (184–236) | Stats only render when year & month filters set; no all-time fallback. |

---

## Out of Scope

- **Recurring transaction detection and alerts** — Requires backend logic and notifications service.
- **Budget forecasting and insights** — Advanced analytics requiring data science integration.
- **Multi-account support** — Requires backend schema changes.
- **Data export (CSV, PDF)** — Requires report generation library.
- **Dark mode toggle** — Already supported via system preferences; explicit toggle deferred.
- **Accessibility overhaul** — ARIA labels, keyboard navigation, screen reader testing — separate effort.

---

## Implementation Roadmap

**Phase 1 (Weeks 1–2): Quick Wins**
- Empty state components
- Active filter badge on mobile

**Phase 2 (Weeks 3–4): Core Interaction**
- Clickable transaction rows
- Optimistic updates for mutations

**Phase 3 (Weeks 5–6): Polish**
- Right panel width persistence
- All-time stats view
- iOS Safari tap target and input mode fixes

---

## References

- **Component files:** `/Users/asifahmed/code/experiments/jarvis/finance-tracker-app/client/src/components/TransactionTable.tsx`, `TransactionStats.tsx`, `TransactionsPage.tsx`
- **API layer:** `/Users/asifahmed/code/experiments/jarvis/finance-tracker-app/client/src/lib/api.ts`
- **Layout standards:** `/Users/asifahmed/code/experiments/jarvis/docs/LAYOUTS.md`
- **Product vision:** `/Users/asifahmed/code/experiments/jarvis/docs/FUTURE_VISION.md`

