# Jarvis Frontend Tech Debt Remediation Document

## TL;DR

Jarvis has **8 critical tech debt items** that impede maintainability, performance, and developer experience. The highest-priority items are god components (TransactionTable, TrendsPage) causing cognitive overload, hardcoded API endpoints preventing multi-environment deployment, missing error handling infrastructure, and unused router dependency creating build bloat. Most items are **medium effort** with **high value** and can be sequenced incrementally. Estimated total remediation: 60-80 hours over 3-4 weeks.

---

## Items

### 1. God Component: TransactionTable (1,115 lines, 10 state hooks)

**Severity:** HIGH

**Evidence:**
- `/client/src/components/TransactionTable.tsx:1-1115`
- 10 `useState` hooks: editingTransaction, duplicatingTransaction, splittingTransaction, viewingRawTransaction, isLoadingRawData, isCreating, sortField, sortDirection, actionLoadingId
- Inline subcomponents: InlineEdit (lines 85-150), InlineSelect (lines 160-221), merchant icon logic (lines 245-335)
- Multiple responsibilities: row rendering, inline editing, transaction creation, splitting, status updates, data fetching

**Cost of Inaction:**
- Future feature additions require deep diving through 1,115 lines of intertwined logic
- Bug fixes in one feature risk breaking adjacent features (e.g., edit state interferes with creation state)
- New developers have high ramp-up time; reviewers struggle to reason about PR changes
- Performance optimization is blocked by unclear data flow

**Recommended Fix:**
Extract into 4 focused components:
1. **TransactionRow**: Pure row rendering (merchant, amount, category, date)
2. **InlineEdit** / **InlineSelect**: Standalone extracted subcomponents
3. **TransactionActionButtons**: Status toggles and context menu
4. **TransactionRowContainer**: Orchestrates row + action handlers (wraps the extracted components)

Move state management to parent (TransactionsPage) using a reducer or separate context for transaction edit state.

**Effort:** LARGE (16-20 hours)

**Blast Radius:** MEDIUM - TransactionsPage is single-page consumer; changes are isolated if API unchanged

**Prerequisites:**
- Establish clear row state shape in TransactionsPage reducer
- Define prop contracts for extracted components
- Ensure existing tests cover row interactions (create test suite if missing)

---

### 2. God Component: TrendsPage (1,542 lines, 18+ state hooks)

**Severity:** HIGH

**Evidence:**
- `/client/src/pages/TrendsPage.tsx:1-1542`
- 18+ `useState` hooks: monthRange, selectedSources, hiddenCategories, hiddenMerchants, hideOther, showMovingAvg, categoryCount, merchantCategoryFilter, pinnedCategoryDot, copyStatus, merchantQuery, merchantExact, merchantStartMonth, merchantEndMonth, merchantSuggestionsOpen, highlightedMerchantSuggestion, hoveredCategoryDot, hoveredMerchantDot, drilldownCategory, drilldownTransactions, drilldownSubtitle
- 3+ complex `useEffect` hooks; 5+ `useMemo` calculations
- Inline helpers: getCategoryChartData, getMerchantChartData, calculateMovingAverage, formatAxisCurrency, getMonthRange, filterByMonthRange, renderCategoryDot, renderMerchantDot, renderClickableLegend, renderCategoryDotTooltip, renderMerchantDotTooltip
- Responsibilities: chart data aggregation, filtering, merchant search, modal management, tooltip rendering

**Cost of Inaction:**
- Trends feature is a black box; any UX change requires understanding 1,542 lines
- Moving average, date range, and filtering logic is brittle and hard to test independently
- Performance suffers from redundant useMemo calculations and lack of granular component boundaries
- Merchant search UI is tightly coupled to page-level state; reusing it elsewhere is not feasible

**Recommended Fix:**
Extract into 4-5 focused sections:
1. **TrendsFilterBar**: Month range, year, source toggles, category count, hide-other button
2. **TrendsChartSection**: Monthly spending chart with moving average toggle (uses useMemo for data prep)
3. **MerchantSearchPanel**: Merchant search input, suggestions dropdown, date range picker (local state + custom hook)
4. **BudgetTrackingGrid**: Per-budget mini-charts and variance displays
5. **CategoryDrilldownModal**: Modal state, transaction list (extract existing modal logic)

Create custom hooks:
- `useTrendsFilters()`: Centralize monthRange, selectedSources, hiddenCategories state
- `useMerchantSearch()`: Encapsulate merchant query, suggestions, exact toggle
- `useTrendsData()`: Aggregate and memoize getTrends API call and category/merchant breakdowns

**Effort:** LARGE (20-24 hours)

**Blast Radius:** MEDIUM - TrendsPage is single-page consumer; some components (MerchantSearchPanel, BudgetTrackingGrid) could be reused in other pages if extracted well

**Prerequisites:**
- Design hook contracts for state sharing across extracted components
- Test data filtering and chart calculation logic independently
- Establish component boundaries (define what each component owns vs. receives via props)

---

### 3. Dual Router Installation: react-router-dom + wouter (Unused)

**Severity:** MEDIUM

**Evidence:**
- `package.json`: Line 50 react-router-dom (^7.11.0), Line 54 wouter (^3.3.5)
- Active usage: react-router-dom imported in 7 files (main.tsx, App.tsx, ChatWidget.tsx, Navbar.tsx, TrendsPage.tsx, TransactionsPage.tsx, YearlyBudgetPage.tsx)
- Wouter usage: Zero imports found in codebase (grep -r "wouter" returned 0 matches in src/)
- Bundle impact: ~8-12 KB minified gzip (~25-30 KB uncompressed)

**Cost of Inaction:**
- Dead code increases bundle size and build time
- Developers are confused about routing pattern; maintenance burden for justifying why two routers exist
- Future dependency updates require updating unnecessary package
- Tree-shaking cannot eliminate wouter if it remains a dependency (even if unused in source code)

**Recommended Fix:**
1. Remove wouter from `package.json`: `npm uninstall wouter`
2. Verify no hidden imports via deeper codebase search
3. Confirm all routing works via react-router-dom primitives (Routes, Route, Link, useNavigate, useSearchParams)
4. Update CI/CD and deployment scripts to regenerate lock files

**Effort:** SMALL (1-2 hours)

**Blast Radius:** MINIMAL - Wouter is not used; removal is safe and isolated to package.json and lock files

**Prerequisites:**
- Run full test suite after removal to ensure no hidden dependencies
- Verify build completes and bundle size decreases as expected

---

### 4. Hardcoded API URL (Production Domain in Source)

**Severity:** MEDIUM

**Evidence:**
- `/client/src/lib/api.ts:7`: `export const API_BASE_URL = 'https://sifxtre.me/api';`
- URL is hardcoded in source; no environment-based configuration
- Prevents staging, development, and preview deployments using different backends
- Netlify PR preview builds will hit production API

**Cost of Inaction:**
- Cannot run staging environment (e.g., QA testing on separate backend)
- PR preview builds pollute production data
- Local development cannot use local API without code modification
- Onboarding new developers requires explaining this workaround

**Recommended Fix:**
1. Define `VITE_API_BASE_URL` environment variable with default fallback: `https://sifxtre.me/api`
2. Update `api.ts` line 7: `export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sifxtre.me/api';`
3. Create `.env.local` template (not committed): `VITE_API_BASE_URL=http://localhost:8000/api`
4. Update Netlify environment settings to inject `VITE_API_BASE_URL` for production builds
5. Document in README: "Set `VITE_API_BASE_URL` env var to override API endpoint"

**Effort:** SMALL (1-2 hours)

**Blast Radius:** MINIMAL - Changes are isolated to api.ts and environment setup; no component logic changes needed

**Prerequisites:**
- Ensure Vite is configured with env variable support (default; no changes needed)
- Test with different `VITE_API_BASE_URL` values in local dev and CI/CD pipelines

---

### 5. Missing Error Boundary

**Severity:** HIGH

**Evidence:**
- `/client/src/App.tsx:1-110`: No React.errorCatcher or class component ErrorBoundary
- Zero matches for "ErrorBoundary" or "error.*boundary" in entire codebase
- If any component throws during render, the entire app unmounts with white screen
- No graceful fallback UI; user sees browser error page

**Cost of Inaction:**
- Runtime errors in any component (e.g., TransactionTable, TrendsPage) crash entire app
- User loses session context and navigation
- No error telemetry; developers only learn about crashes via user reports
- Bad UX: no way for user to recover or navigate to a different page

**Recommended Fix:**
1. Create `components/ErrorBoundary.tsx` (class component):
   ```typescript
   class ErrorBoundary extends React.Component {
     state = { hasError: false, error: null };
     static getDerivedStateFromError(error) { return { hasError: true, error }; }
     componentDidCatch(error, info) { logger.error('React Error Boundary:', error, info); }
     render() {
       if (this.state.hasError) {
         return <ErrorFallback error={this.state.error} />;
       }
       return this.props.children;
     }
   }
   ```
2. Wrap App content: `<ErrorBoundary><Navbar /> ... </ErrorBoundary>`
3. Create `ErrorFallback` component with "Something went wrong" UI + "Go Home" button
4. Log errors to monitoring service (Sentry, LogRocket, etc.)

**Effort:** MEDIUM (4-6 hours including fallback UI and logging setup)

**Blast Radius:** LOW - Error Boundary is parent wrapper; does not affect component logic or props

**Prerequisites:**
- Decide on error monitoring service (optional but recommended)
- Test error boundary by intentionally throwing in a component during dev

---

### 6. No Code Splitting / Lazy Component Loading

**Severity:** MEDIUM

**Evidence:**
- `/client/src/main.tsx:1-19`: All route components imported eagerly (TransactionsPage, YearlyBudgetPage, TrendsPage, TellerRepairPage, CalendarPage, ChatPage)
- `/vite.config.ts:1-16`: No `build.rollupOptions` for manual chunk splitting
- No `React.lazy()` calls in codebase; zero matches for "lazy" in src/
- Initial bundle includes code for all 6 pages + all dependencies; users download unused pages on load
- Estimated impact: ~30-40% of bundle is not needed on initial page load

**Cost of Inaction:**
- Initial page load is slower; Time to Interactive (TTI) is higher
- First Contentful Paint (FCP) is delayed, especially on slow networks
- Mobile users pay cost of downloading code for Teller Repair page (rarely used) on day 1
- Vite's auto-splitting is not happening because route components are eagerly imported

**Recommended Fix:**
1. Convert route imports to lazy loading:
   ```typescript
   import { lazy, Suspense } from 'react';
   const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
   const TrendsPage = lazy(() => import('./pages/TrendsPage'));
   // ... etc for other routes
   ```
2. Wrap routes with Suspense boundary:
   ```typescript
   <Suspense fallback={<LoadingFallback />}>
     <Routes>
       <Route path="/" element={<TransactionsPage />} />
       {/* ... */}
     </Routes>
   </Suspense>
   ```
3. Test bundle with `npm run build && vite preview` to verify chunks are created for each route
4. Monitor bundle size: `npm run build -- --manifest` and inspect `.vite/manifest.json`

**Effort:** MEDIUM (6-8 hours including testing and LoadingFallback UI)

**Blast Radius:** LOW - Route rendering is refactored; no prop changes or data flow changes needed

**Prerequisites:**
- Ensure LoadingFallback component matches design (can reuse existing loading skeleton)
- Verify React.lazy + Suspense are supported in target browsers (React 18+ is safe)

---

### 7. Unused Toaster Component (Mounted but Never Used)

**Severity:** LOW

**Evidence:**
- `/client/src/App.tsx:104`: `<Toaster />` is mounted in root layout
- `/client/src/components/ui/toaster.tsx:1-20`: Toaster component exists and uses useToast hook
- `/hooks/use-toast.ts`: Toast hook is exported
- Active usage: Only `ChatPanel.tsx` (3 toast calls) and `api.ts` (2 toast calls for errors) use `toast()` function
- 99% of app functionality does not trigger toasts; Toaster is wired up but underutilized
- Impact: DOM nodes + CSS + JavaScript for 0-5 toasts in typical session

**Cost of Inaction:**
- Inconsistency: most UX feedback is silent (no toast), creating confusing user experience
- Dead code: Toaster component adds ~2-3 KB minified; marginal but unnecessary
- Maintenance burden: if Toaster is refactored, it must be tested even though most features don't use it
- Users don't receive feedback on actions (create transaction, edit budget, etc.)

**Recommended Fix:**
1. Audit all user actions that should trigger feedback (create transaction, update category, split, delete, etc.)
2. Add `toast()` calls to action handlers in:
   - TransactionTable: on successful create, update, delete, split (4-5 toasts)
   - TrendsPage: on category drill-down, merchant search (2 toasts)
   - YearlyBudgetPage: on budget update (1-2 toasts)
   - CalendarPage: on event update (1 toast)
3. Standardize success vs. error toast styling
4. Document toast usage: "Call `toast({ title, description, variant })` after async action completes"

**Effort:** MEDIUM (8-10 hours for comprehensive action coverage)

**Blast Radius:** LOW - Toaster is already mounted; only adding new call sites in existing components

**Prerequisites:**
- Define which actions warrant user feedback (distinguish between silent operations and user-initiated actions)
- Test that toasts render without layout shift or accessibility issues

---

### 8. No React Query DevTools (Missing Development Tool)

**Severity:** LOW

**Evidence:**
- `package.json`: `@tanstack/react-query` is installed (line 38)
- Zero imports of `@tanstack/react-query-devtools` in codebase
- DevTools package is not in dependencies or devDependencies
- Without DevTools, developers cannot inspect query state, cache, stale times, or network activity

**Cost of Inaction:**
- Debugging query issues requires adding temporary console.logs or React Dev Tools inspection
- Cache behavior is opaque; hard to understand why data is stale or not refetching
- Slower debugging of API integration bugs
- New developers cannot explore React Query features visually

**Recommended Fix:**
1. Install DevTools: `npm install --save-dev @tanstack/react-query-devtools`
2. Add to `main.tsx` inside QueryClientProvider:
   ```typescript
   import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
   // ... inside render:
   <QueryClientProvider client={queryClient}>
     <App />
     <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
   </QueryClientProvider>
   ```
3. DevTools will only render in development (conditional rendering built-in)
4. Document in README: "Press Ctrl+Shift+Q (or Cmd+Shift+Q) to toggle React Query DevTools"

**Effort:** SMALL (1-2 hours)

**Blast Radius:** MINIMAL - DevTools are dev-only; no production code changes

**Prerequisites:**
- Ensure `import.meta.env.DEV` is available (Vite provides this by default)
- Test that DevTools toggle works and doesn't crash during build

---

### 9. Lenient TypeScript Configuration (Non-Strict Mode Not Enabled)

**Severity:** LOW

**Evidence:**
- `/tsconfig.json:10`: `"strict": true` is set ✓
- However, `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, etc. are covered by `strict: true`
- Finding: `skipLibCheck: true` (line 14) disables type checking of .d.ts files
- `allowImportingTsExtensions: true` (line 15) allows importing .ts files directly (can mask module resolution issues)
- Overall: Config is strict but has two pragmatic exceptions

**Cost of Inaction:**
- `skipLibCheck: true` hides type errors in node_modules (safe for compilation speed but reduces type safety)
- `allowImportingTsExtensions: true` can mask incorrect path imports (should use .js extension in ESM)
- Type safety is not at maximum; some runtime errors could be caught at compile time

**Recommended Fix:**
No immediate action needed. Current configuration is reasonable and intentional:
- `skipLibCheck: true` is a standard practice (dramatically speeds up compilation)
- `allowImportingTsExtensions: true` is acceptable for monorepo / bundler-based setups (Vite handles .ts imports)

If stricter checking is desired in the future:
1. Review whether `skipLibCheck: false` impacts build time significantly
2. Audit imports using `.ts` extension; convert to `.js` where feasible (Vite will map them)
3. Document why exceptions exist (to prevent future removals that break the build)

**Effort:** N/A (no changes recommended)

**Blast Radius:** N/A

**Prerequisites:** N/A

---

## Recommended Sequencing

### Phase 1: Foundation (Weeks 1-2) - 12-16 hours
1. **Remove wouter** (1-2 hours) - Unblocks build, eliminates confusion
2. **Add error boundary** (4-6 hours) - Protects against runtime crashes
3. **Configure API URL via env vars** (1-2 hours) - Enables multi-environment deployments
4. **Install React Query DevTools** (1-2 hours) - Quick win; aids debugging

**Outcome:** App is more robust, deployment-ready, and developer-friendly.

### Phase 2: Code Quality (Weeks 2-3) - 24-30 hours
5. **Extract TransactionTable god component** (16-20 hours) - Highest cognitive load; improves maintainability
6. **Add comprehensive toast feedback** (8-10 hours) - Improves UX; builds confidence in Toaster
7. **Implement code splitting for routes** (6-8 hours) - Improves initial load performance

**Outcome:** Major components are modular; bundle size is optimized; UX feedback is consistent.

### Phase 3: Advanced (Week 3-4) - 20-24 hours
8. **Extract TrendsPage god component** (20-24 hours) - Most complex refactor; unlock chart reusability

**Outcome:** All pages are modular; dashboard could be refactored to compose Trends, Budget, Trends charts from extracted pieces.

---

## Out of Scope

The following are **not** included in this tech debt remediation because they are either architectural, low-impact, or require separate initiatives:

- **State Management Refactor**: Zustand vs. Context API is a design decision; not debt
- **E2E Testing**: Cypress/Playwright setup is best done as separate initiative with test plan
- **Responsive Design**: Mobile-first improvements are UX feature work, not tech debt
- **Internationalization (i18n)**: Adding language support is a feature, not debt
- **Storybook**: Component documentation is a nice-to-have; not blocking development
- **Backend Coupling**: API response types could be generated from OpenAPI spec, but requires backend coordination
- **Form Validation Library**: Current form patterns work; migrating to Zod/Yup is optional
- **Chakra UI Migration**: Design system changes are separate from tech debt
- **Performance Monitoring (Sentry, etc.)**: Error tracking is recommended but not debt; separate implementation
- **Accessibility Audit**: a11y improvements should be continuous; not a one-time debt item

---

## Summary Table

| Item | Severity | Effort | Value | Blockers | Phase |
|------|----------|--------|-------|----------|-------|
| 1. TransactionTable god component | HIGH | LARGE | HIGH | None | Phase 2 |
| 2. TrendsPage god component | HIGH | LARGE | HIGH | TBD on other page needs | Phase 3 |
| 3. Dual routers (wouter unused) | MEDIUM | SMALL | MEDIUM | None | Phase 1 |
| 4. Hardcoded API URL | MEDIUM | SMALL | MEDIUM | None | Phase 1 |
| 5. Missing error boundary | HIGH | MEDIUM | HIGH | None | Phase 1 |
| 6. No code splitting | MEDIUM | MEDIUM | MEDIUM | TBD: test lazy loading | Phase 2 |
| 7. Underused Toaster | LOW | MEDIUM | LOW | Design decision on feedback UX | Phase 2 |
| 8. No React Query DevTools | LOW | SMALL | LOW | None | Phase 1 |
| 9. TypeScript config | LOW | N/A | N/A | No action needed | — |

---

**Document generated:** April 2026
**Codebase:** Jarvis Finance Tracker (React 18, Vite, TypeScript, Netlify)
**Prepared for:** Frontend Tech Debt Remediation Initiative
