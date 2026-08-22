# Code guide — how this project is put together

This is a plain, no-magic React + Express codebase. No build wizardry, no
hidden config, nothing generated. Every file is short and does one thing,
so you should be able to open any file and understand it top to bottom.
This doc is a map, plus a "how do I..." list for the changes you're most
likely to want to make yourself.

## The big picture

```
backend/    Express API — talks to Postgres, talks to Gemini, that's it.
frontend/   React app (Vite) — pages + components, talks to the API.
```

They're two separate npm projects. The frontend never touches the
database directly — it only calls `backend`'s HTTP routes via
`frontend/src/api/client.js`.

## Backend map

```
backend/
  server.js              Entry point. Wires up middleware + mounts every route file.
  db.js                  Postgres connection (Neon/pg-pool).
  schema.sql             The entire database structure, in one file.
  gemini.js              One function: callGemini(). Everything AI-related goes through it.
  lib/
    attendanceSummary.js Attendance math (percentage, "safe to miss", college points system).
                          Shared by normal attendance route & public view-only route.
    financeSummary.js    Finance math (monthly income, expense, net, category breakdown, budget).
  middleware/
    auth.js               Checks the JWT on protected routes, sets req.userId.
  routes/
    auth.js                register / login / me (profile & budget update) / view-token
    subjects.js             CRUD for subjects (used by Timetable & Attendance)
    attendance.js            mark/list/summary for day-wise attendance
    todos.js                CRUD for to-dos + note-to-date parsing
    timetable.js             CRUD for weekly class slots
    finance.js               Income/expense CRUD, bulk category updates & delete, AI statement upload
    grades.js                CRUD for semester courses, SGPA/CGPA calculations, grade card OCR upload
    ai.js                    AI chat assistant (with injected context), exam & grade card upload
    dashboard.js              streaks, upcoming exams, today's counts & summary metrics
    view.js                   the public read-only endpoint (no login needed)
    holidays.js                mark/list/delete "no college" days + holiday-list upload
  utils/
    dateHelpers.js          Backend date formatting & ISO date helpers
    parseDate.js            turns "submit assignment fri" into a date
  scripts/
    migrate.js               runs schema.sql against your database
```

Every route file follows the same shape: import `getPool` from `db.js`,
write plain SQL with `$1, $2...` placeholders, return JSON. There's no ORM
translating things behind your back — the SQL in the route *is* the query
that runs.

## Frontend map

```
frontend/src/
  main.jsx                Mounts the app, wraps it in Theme, Auth, Toast, Confirm & Announcer providers.
  App.jsx                 All routes live here. This is the first place to look when adding a new page.
  index.css               Design token system (`:root`, `[data-theme="ink"]`, `[data-theme="parchment"]`).
                           Standardized 380px/640px/768px breakpoints, utility classes (`.modal-overlay`,
                           `.modal-content`, `.stat-grid`, `.badge-tag`), custom scrollbars, animations.
  context/
    AuthContext.jsx        Holds the logged-in user + login/register/logout & 401 interceptor.
    ThemeContext.jsx        Holds "ink" or "parchment", persists to localStorage.
    ToastContext.jsx        App-wide toast notification surface for success and error alerts.
    ConfirmContext.jsx      Promise-returning replacement for native window.confirm dialogs.
    AnnouncerContext.jsx    Polite aria-live region for screen-reader loading/action announcements.
  hooks/
    useAsyncAction.js       Async mutation wrapper managing toast notifications and loading state.
    useDialog.js            Accessibility hook for modal focus trapping, Escape-to-close, and scroll lock.
  utils/
    format.js               Centralized date math (`pad`, `toISO`, `parseLocalDate`) & currency (`rupees`).
    fileToBase64.js         File and ArrayBuffer conversion helper for AI OCR uploads.
    timetableUtils.js       Slot grouping, merged block creation, duplicate checks, preset classes.
  api/
    client.js               Fetch wrapper with 20s request timeout, 30s stream timeout, and 401 handling.
  components/
    timetable/              Decomposed timetable subcomponents:
      TimetableHeader.jsx      Header navigation, class selector pills, and mode buttons.
      TimetableViews.jsx       Columns, Grid (Routine Matrix), and Agenda layout renderers.
      TimetableSlotModal.jsx   Add slot form and edit slot dialog.
      TimetableAiModal.jsx     AI OCR timetable image/PDF upload modal.
      TimetableCustomizerModal.jsx Display preferences & theme customizer panel.
    finance/                Decomposed finance subcomponents:
      FinanceOverview.jsx      Monthly summary cards, category spending bars, and budget progress.
      FinanceImportModal.jsx   Statement PDF/screenshot upload & password decryption modal.
      FinanceTransactionList.jsx Bulk selection, category filters, and transaction row manager.
    ReorderControls.jsx      Keyboard navigation buttons for drag-and-drop lists.
    Sidebar.jsx              Desktop nav (hidden below 768px). Links live in the `links` array.
    MobileNav.jsx             Mobile bottom tab bar + "More" sheet (shown below 768px).
    FileUpload.jsx            Drag-and-drop file uploader for statements/screenshots/PDFs.
    BunkSimulator.jsx         Interactive attendance & bunk calculator simulator.
    CGPATrendVisualizer.jsx   CGPA / SGPA progress visualizer.
    ViewOnlyLinkCard.jsx      Shareable view-only link generator card.
    AttendanceRing.jsx       Circular progress ring, reused in dashboard & attendance.
    ThemeToggle.jsx          The ink/parchment switch buttons.
    Switch.jsx                Accessible toggle button.
  pages/
    Dashboard.jsx            Streaks, attendance summary, to-dos, upcoming exams & finance preview.
    Attendance.jsx           Subject-wise attendance, day logger, bunk predictor & simulator.
    Finance.jsx              Monthly finance summary, statement upload, month navigation picker,
                             category breakdown (`Family`, `Food`, `Hostel/Rent`, `Travel`,
                             `Subscriptions`, `Shopping`, `Education`, `Entertainment`, `Other`),
                             bulk selection & category edit.
    Grades.jsx               Semester-wise grade tracker, SGPA/CGPA visualizer, grade card OCR upload.
    Timetable.jsx            Weekly schedule planner & slot manager.
    Todos.jsx                To-do list manager & assignment tracker.
    AIChat.jsx               Streaming AI assistant with student context.
    Profile.jsx              User profile settings, monthly budget configuration, password update,
                             and view-only link regeneration.
    ViewOnly.jsx             Public read-only dashboard for shared view-only links.
```

## How do I... (common edits)

**Change a color or font.**
Edit the CSS variables at the top of `frontend/src/index.css` — everything
references `var(--accent)`, `var(--bg)`, etc, so one edit updates the whole
app. `--font-display` is the serif headings, `--font-body` is everything else.

**Add a new page.**
1. Create `frontend/src/pages/YourPage.jsx` (copy an existing simple one,
   like `Timetable.jsx`, as a starting point).
2. Add it to the `links` array in `Sidebar.jsx` (desktop nav) **and** either
   `primaryLinks` or `moreLinks` in `MobileNav.jsx` (mobile nav) — the two
   are separate because there's only room for 4 tabs plus "More" on a phone.
3. Add a `<Route>` for it in `App.jsx`.

**Add a new financial category** (e.g. "Healthcare").
1. Add `"healthcare"` to the `CATEGORIES` array in `backend/lib/financeSummary.js`.
2. Add `"healthcare"` to the category list in Gemini's upload system prompt in `backend/routes/finance.js`.
3. Add `healthcare: "Healthcare"` to `CATEGORY_LABELS` in `frontend/src/components/finance/FinanceOverview.jsx` & `FinanceTransactionList.jsx`.

**Perform bulk updates on transactions.**
The API provides `PUT /api/finance/transactions/bulk` taking `{ ids: [...], category: "..." }` and `DELETE /api/finance/transactions/bulk`. On the frontend, toggle "Bulk Edit / Select" mode in `FinanceTransactionList.jsx` to select items and apply category changes.

**How statement deduplication works.**
When uploading bank statements or UPI screenshots via `POST /api/finance/upload`, the backend queries existing transactions matching `(user_id, date, amount, type, LOWER(merchant))` before inserting to avoid double-counting.

**Add a field to an existing table** (e.g. a "location" field on exams).
1. Add the column in `schema.sql` using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
   so it's safe to re-run.
2. Run `npm run migrate` in `backend/` to apply it.
3. Update the relevant route in `backend/routes/` to read/write the new column.
4. Update the relevant page in `frontend/src/pages/` to show/edit it.

**Change how the AI responds** (chat tone, exam-parsing rules, statement parsing).
Each prompt lives directly in `backend/routes/ai.js` or `backend/routes/finance.js` as a
`systemInstruction` string — edit the text directly; no templating system to fight with.

**Nothing here covers what you're trying to do?**
Every file is kept small and modular on purpose. If you're not sure where
something lives, search the codebase for the text you see on screen (e.g.
search for `"Spending by category"` to find the finance code that renders it)
— that will land you in the right file almost every time.
