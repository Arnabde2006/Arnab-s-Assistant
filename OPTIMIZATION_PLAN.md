# Performance Optimization Plan — Arnab's Assistant

_Analysis date: 2026-08-21. No code was changed; this is a plan._

## Verdict: is the code good?

Yes — this is a well-built, coherent full-stack app, clearly above typical hobby-project quality. The backend has proper security hygiene (Helmet, CORS allowlist, tiered rate limiting, JWT auth middleware, centralized async error handling, fail-fast on missing secrets), the schema is sensibly normalized with `ON DELETE CASCADE` and a solid set of indexes, and dates are handled carefully. The frontend is clean: on-mount fetches consistently use `Promise.all` (no request waterfalls), timers and event listeners are cleaned up correctly (no leaks), and `view.js` on the backend is genuinely exemplary (single `Promise.all`, explicit columns, `LIMIT`).

So the performance issues below are **concentrated and fixable, not systemic**. The two biggest wins are cheap. The rest is about not re-doing work — in the browser's render loop, and in round-trips to the database.

Impact/effort tags: **Impact** = how much faster the user feels it; **Effort** = rough work to implement.

---

## Tier 1 — Biggest wins, lowest effort (do these first)

### 1. Route-based code splitting on the frontend
**Impact: High · Effort: Low**

`frontend/src/App.jsx:7-22` eagerly imports all 16 pages (Dashboard, Attendance, Timetable, Finance, Debts, etc.) plus their heavy children (`Timetable.jsx` is 1,912 lines, `Debts.jsx` 1,001, `Nptel.jsx` 944, `CGPATrendVisualizer.jsx` 745). Everything ships in one bundle, so someone landing on `/login` downloads the entire application before they can type their password.

Fix: convert page imports to `React.lazy(() => import("./pages/X.jsx"))` and wrap `<Routes>` in `<Suspense fallback={<LoadingScreen />}>`. Login/Register/ViewOnly then load a tiny bundle; each page's code arrives on navigation. This is the single highest-leverage change for first-load and Time-to-Interactive.

### 2. Enable HTTP response compression on the backend
**Impact: High · Effort: Low**

`backend/server.js` has no `compression` middleware, so every JSON response goes over the wire uncompressed — including large ones (NPTEL courses + all assignments, full transaction/attendance history, AI chat context).

Fix: `npm i compression`, then `app.use(compression())` near the top of the middleware chain. JSON typically compresses 70–90%. One line, every endpoint benefits.

### 3. Vite build configuration
**Impact: Medium · Effort: Low**

`frontend/vite.config.js` is bare (just the React plugin). Combined with #1, add `build.rollupOptions.output.manualChunks` to split vendor code (react, react-dom, react-router) into a long-cached chunk separate from app code.

Also verify `lucide-react` (`package.json:12` pins `^1.25.0`, an anomalous version for that library — the normal line is `0.x`). Icons are imported named (tree-shakeable, good), but a mismatched build can bloat the dev module graph and slow HMR. Confirm what actually resolved and pin a current version.

### 4. Fix the Dashboard endpoint (it's the landing page)
**Impact: High · Effort: Low–Medium**

`backend/routes/dashboard.js` runs three independent queries **sequentially** (lines 16, 49, 57), each `SELECT *` unbounded for the user, then does two 730-iteration JS loops (lines 34, 66) and `.filter()` counts to compute streaks and pending counts.

Fix: `Promise.all` the three queries; compute `pendingToday`/`totalPendingUpcoming` with SQL `COUNT(*) FILTER (WHERE ...)`; bound the streak scan with a `date >=` filter instead of scanning all history. This is the first request every logged-in user makes, so latency here is felt most.

---

## Tier 2 — High impact, moderate effort

### 5. Remove "writes-on-read" in the NPTEL list endpoint
**Impact: High · Effort: Medium**

`backend/routes/nptel.js:74-94`: `GET /` loops over every course, runs a `SELECT` per course, and if a date looks stale issues up to `duration_weeks` `UPDATE`s — a read endpoint doing `O(courses × weeks)` round-trips and **writing to the DB on every page view**. The JOIN right below (line 96) already returns week-1 dates, making the per-course SELECT redundant too.

Fix: move this auto-correction into a one-time migration (`scripts/migrate.js`) and delete it from the read path. The GET then becomes two clean queries.

### 6. Aggregate attendance in SQL instead of fetching-all-and-counting
**Impact: High · Effort: Low–Medium**

`backend/lib/attendanceSummary.js:5-16` (used by `GET /attendance/summary` **and** every public `GET /view/:token`) runs three independent queries serially and does `SELECT *` on all attendance rows just to run three `.filter().length` passes in JS. Same pattern in the AI chat route (`routes/ai.js:159,169-173`).

Fix: `Promise.all` the queries and replace the row fetch with `SELECT status, COUNT(*) FROM day_attendance WHERE user_id=$1 GROUP BY status`. This is a hot, publicly reachable path — good place to be efficient.

### 7. Memoize heavy render-body computation on the frontend
**Impact: High (perceived jank) · Effort: Medium**

Several pages recompute expensive derivations on every render, including on every keystroke or streaming token:

- `Debts.jsx:113-172` — filters, reduces, a `forEach` building a person map over all debts, plus a `map().sort()`, all in the render body. Typing in the search box re-runs the whole aggregation each keystroke. Wrap in `useMemo([debts])`, and the search filter in a separate `useMemo([list, searchQuery])`.
- `Todos.jsx:189-206, 246-390` — rebuilds a 60+ day planner with nested per-day `filter`s over todos/subscriptions/NPTEL every render. Precompute a `Map` of date→events once via `useMemo`.
- `Dashboard.jsx:289-367` — an ~80-line markdown/table parser (`formatMessage`) re-runs over the **entire chat history** on every streaming token. Memoize per-message HTML so only the live bubble re-parses.
- `Finance.jsx:366-369` + `Timetable.jsx:327-333` — unmemoized filters/derivations; wrap in `useMemo`, and `React.memo` the row/cell components with `useCallback` handlers.

### 8. Stop refetching all transactions on every month switch
**Impact: Medium · Effort: Low**

`Finance.jsx:252-263` — changing the selected month re-downloads the **entire** unfiltered `/finance/transactions` list every time, then filters client-side. Fetch transactions once on mount and derive the month view client-side, or pass a month param and cache per month.

### 9. Add two missing indexes
**Impact: Medium · Effort: Low**

- `day_attendance` is filtered by date range and `ORDER BY date` (`routes/attendance.js:32-50`) but only has a `(user_id)` index. Add composite `(user_id, date)` — also speeds up #4 and #6.
- `nptel_assignments` is filtered by `user_id` (`routes/nptel.js:100`, `routes/ai.js:165`) but the only index is `(course_id, due_date)`. Add `(user_id, due_date)`.

Add these to `schema.sql` and the migration.

---

## Tier 3 — Good hygiene (fold in when you touch these areas)

### 10. Batch the N+1 insert/update loops
**Impact: Medium · Effort: Medium**

Several endpoints do one round-trip per item in a loop: NPTEL assignment creates and reorder (`routes/nptel.js:167-203, 255-260, 343-351`), subscriptions bulk-create and reorder (`routes/subscriptions.js:66-71, 168-189`), finance import dedup+insert (`routes/finance.js:183-203`), exam-timetable import (`routes/ai.js:288-300`), and holiday upload (`routes/holidays.js:86-97`). Replace with multi-row `INSERT ... VALUES (…),(…)` or `INSERT ... SELECT * FROM unnest($1,…)`, and for reorder use `UPDATE … FROM unnest($1) WITH ORDINALITY`. These are bulk/import paths, so lower everyday impact but big when they run.

### 11. Add a lightweight client data cache + optimistic updates
**Impact: Medium · Effort: Medium**

`api/client.js` has no caching/dedup, so navigating between pages refetches everything each visit. Worse, mutations trigger a full multi-endpoint refetch — e.g. ticking one todo re-downloads todos + holidays + subscriptions + NPTEL (`Todos.jsx`), and marking attendance refetches all three of its endpoints (`Attendance.jsx:121,131,148`). Adopt a small cache (or TanStack Query / SWR) and use optimistic local updates or targeted single-endpoint refetches instead of `refresh()`.

### 12. Downscale images before base64 upload
**Impact: Medium (on mobile/large photos) · Effort: Low–Medium**

`utils/fileToBase64.js` encodes the whole file with no resize. Phone photos (holiday lists, statements, grade cards) get held in state and POSTed at ~+33% size, and the server parses them under a global 15 MB JSON limit. Downscale via `<canvas>`/`createImageBitmap` before encoding.

### 13. Paginate unbounded lists
`routes/finance.js:37-55` returns all transactions when no date range is given. Add `LIMIT`/keyset pagination; pairs with #8.

### 14. Backend boot/config cleanup
Move all runtime DDL out of the request/boot path into `scripts/migrate.js`: the `ALTER TABLE` in `db.js:28` (runs every boot) and the `CREATE TABLE/INDEX IF NOT EXISTS` in `routes/nptel.js` and `routes/subscriptions.js` (first request per process). Give the pg Pool explicit `max`, `idleTimeoutMillis`, `connectionTimeoutMillis` tuned for Neon (`db.js:16-19`).

### 15. AI provider fetch timeouts
`gemini.js` fetches (lines ~193, 302, 395) have no timeout and providers are tried strictly serially (lines ~502-507). A hanging provider stalls the whole request (and holds the SSE connection open). Pass `AbortSignal.timeout(...)` to each call.

### 16. Trim `SELECT *` on hot paths
Replace `SELECT *` with explicit column lists where only a few fields are used (e.g. login `routes/auth.js:64`, dashboard, attendance summary). Smaller rows over the wire, clearer intent.

### 17. CSS cleanup
`src/index.css` is one 2,576-line file with a ~190-line duplicated block (~lines 1759-1951 duplicate ~1565-1757: chat-loading/skeleton/pomodoro rules and their keyframes). Delete the duplicate. Also reduce heavy `backdrop-filter: blur(20-24px)` on cards/sidebar and the fixed multi-radial-gradient body background — both are real paint/compositing cost on mobile scroll.

---

## How to measure (so you can prove it worked)

Run `vite build` and look at the emitted chunk sizes before/after #1–#3 (expect the initial chunk to drop sharply). Run a Lighthouse pass on the deployed frontend for TTI/LCP. On the backend, `EXPLAIN ANALYZE` the dashboard and attendance-summary queries before/after #4, #6, #9 to confirm index usage and fewer rows scanned. A rough ordering by bang-for-buck: **#1, #2, #4, #6** first — they're cheap and touch the most-used paths.
