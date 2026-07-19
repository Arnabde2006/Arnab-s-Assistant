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
  db.js                  Postgres connection (Neon).
  schema.sql             The entire database structure, in one file.
  gemini.js              One function: callGemini(). Everything AI-related goes through it.
  lib/
    attendanceSummary.js Attendance math (percentage, "safe to miss", the college
                          points system). Both the normal attendance route and the
                          public view-only route call this — one source of truth.
  middleware/
    auth.js               Checks the JWT on protected routes, sets req.userId.
  routes/
    auth.js                register / login / me / view-token
    subjects.js             CRUD for subjects (used by Timetable)
    attendance.js            mark/list/summary for day-wise attendance
    todos.js                CRUD for to-dos + the note-to-date parsing
    timetable.js             CRUD for weekly class slots
    ai.js                    chat, exam-timetable upload, grade-card upload
    dashboard.js              streaks + today's counts
    view.js                   the public read-only endpoint (no login needed)
    holidays.js                mark/list/delete "no college" days + holiday-list upload
  utils/
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
  main.jsx                Mounts the app, wraps it in Theme + Auth providers.
  App.jsx                 All routes live here. This is the first place to look
                           when adding a new page.
  index.css               Every color, font, spacing value as CSS variables at
                           the top (`:root`, `[data-theme="ink"]`, `[data-theme="parchment"]`).
                           Change a value here and it updates everywhere.
  context/
    AuthContext.jsx        Holds the logged-in user + login/register/logout.
    ThemeContext.jsx        Holds "ink" or "parchment", persists to localStorage.
  api/
    client.js               Tiny fetch wrapper — adds the auth token, throws on errors.
  components/
    Sidebar.jsx              Desktop nav (hidden below 720px). Links live in the
                             `links` array at the top — add a page there too.
    MobileNav.jsx             Mobile bottom tab bar + "More" sheet (shown below
                             720px instead of Sidebar). Has its own `primaryLinks`
                             (the 4 tabs) and `moreLinks` (in the sheet) arrays —
                             add a new page to one of those, not Sidebar's list.
    AttendanceRing.jsx       The circular progress ring, reused in a few places.
    ThemeToggle.jsx          The ink/parchment switch buttons.
    Switch.jsx                Generic on/off toggle (used for "show college-off days").
  pages/
    One file per page, matching the sidebar. Each page fetches its own data
    with `api.get(...)` in a `useEffect`, keeps it in `useState`, and renders it.
    There's no global state library — every page is self-contained.
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

**Add a field to an existing table** (e.g. a "location" field on exams).
1. Add the column in `schema.sql` using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
   so it's safe to re-run (see how `view_token` was added to `users` as an example).
2. Run `npm run migrate` in `backend/` to apply it.
3. Update the relevant route in `backend/routes/` to read/write the new column.
4. Update the relevant page in `frontend/src/pages/` to show/edit it.

**Change the attendance goal default (currently 75%).**
`attendance_goal INTEGER NOT NULL DEFAULT 75` in `schema.sql` sets it for
new accounts. It's also editable per-user via `PUT /api/auth/me`
(`attendanceGoal` field) — there's no UI for that yet, so you'd add a
small form on a settings/profile page if you want users to change it themselves.

**Change how the AI responds** (chat tone, exam-parsing rules, grade rules).
Each prompt lives directly in `backend/routes/ai.js` as a
`systemInstruction` string — one for chat, one for exam timetables, one for
grade cards. Edit the text directly; no templating system to fight with.

**Change the note-to-date parsing** (e.g. add a new phrase like "next week").
It's all in `backend/utils/parseDate.js`, a single function with plain
regex checks in order (explicit date → "in N days" → "tomorrow"/"today" →
month name → weekday name → fallback to today). Add a new `if` block in
the same style.

**Add a new attendance status** (e.g. "on duty" / "medical leave").
1. Add it to the `CHECK` constraint on `day_attendance.status` in `schema.sql`,
   then re-run migrate.
2. Add it to the `["present", "absent", "half_day"]` validation list in
   `backend/routes/attendance.js`.
3. Decide its point value in `backend/lib/attendanceSummary.js` (search for
   `collegeEarned` — that's where present=2, half_day=1, absent=0 is defined).
4. Add it to `STATUS_META` in `frontend/src/pages/Attendance.jsx`.

**A note on how "no college" days work.**
`day_attendance` (present/absent/half-day) and `college_holidays` (no
college) are two separate tables, and a date can only be in one of them —
whichever route runs last deletes the other's row for that date first (see
the `DELETE FROM ...` line at the top of the `POST /` handlers in both
`attendance.js` and `holidays.js`). That's why the attendance percentage
"just works" without any special-casing: a holiday date never has a
`day_attendance` row, so it's automatically excluded from the total.
If you ever add a third status table like this, keep that same
delete-the-other-one-first pattern or the math will double-count.

**Nothing here covers what you're trying to do?**
Every file is under ~150 lines on purpose. If you're not sure where
something lives, search the codebase for the text you see on screen (e.g.
search for `"Attendance streak"` to find the dashboard code that renders it)
— that will land you in the right file almost every time.
