# Arnab's Assistant — Your personal college companion

A minimalist, dark-first (with live light theme) web app for college life:
day-wise attendance tracking (present/absent/half-day) with safe-to-miss
calculations, a note-based to-do list that auto-arranges itself onto a
calendar, a weekly timetable, exam-timetable upload (AI-read and
auto-added to your calendar), an AI chat assistant, semester grade-card
upload with automatic SGPA/CGPA calculation, and a Pomodoro focus timer.

## Stack
- **Frontend:** React (Vite), React Router — no external UI framework, all custom CSS
- **Backend:** Node.js + Express, plain SQL via `pg`, JWT auth
- **Database:** Neon (serverless Postgres, free tier)
- **AI:** Google Gemini API (chat assistant, exam-timetable OCR, grade-card OCR)

## Project structure
```
college-app/
  backend/    Express API (auth, subjects, attendance, todos, timetable, exams, grades, AI, dashboard)
  frontend/   React app (Vite)
```

New to the codebase? **See [`CODE_GUIDE.md`](./CODE_GUIDE.md)** — a map of
every file plus step-by-step instructions for the edits you're most likely
to want to make yourself (new page, new field, changing colors, changing
the AI prompts, etc).

A `.gitignore` is included, so `node_modules/`, `.env` files, and build
output won't get committed if you push this to GitHub. Only `.env.example`
(with placeholder values, no real secrets) is tracked.

---

## 1. Run it locally first

### Backend
```bash
cd backend
cp .env.example .env
# edit .env: set DATABASE_URL (step 2), a random JWT_SECRET, and GEMINI_API_KEY (step 3)
npm install
npm run migrate   # creates the tables in your Neon database
npm run dev
```
Server runs on `http://localhost:5000`.

### Frontend
```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:5000/api  (already the default)
npm install
npm run dev
```
App runs on `http://localhost:5173`. Register an account and try it out.

---

## 2. Set up a free database (Neon)

1. Go to https://neon.tech and sign up for a free account.
2. Create a new project (any region close to you). Neon creates a default database for you (often called `neondb`).
3. On the project dashboard, click **Connect** and copy the connection string. It looks like:
   `postgresql://<user>:<password>@<endpoint>.neon.tech/neondb?sslmode=require`
4. Paste that into `backend/.env` as `DATABASE_URL`.
5. From the `backend` folder, run `npm run migrate` — this applies `schema.sql` and creates all the tables (`users`, `subjects`, `day_attendance`, `todos`, `timetable_slots`, `exams`, `grade_entries`). Safe to re-run.

You can inspect your data anytime in the **Tables** tab of the Neon console.

---

## 3. Get a free Gemini API key

This powers the AI chat assistant, exam-timetable reading, and grade-card reading.

1. Go to https://aistudio.google.com/apikey and sign in with a Google account.
2. Click **Create API key** (free tier, rate-limited — fine for personal use).
3. Paste it into `backend/.env` as `GEMINI_API_KEY`.

---

## 4. Deploy the backend (Render, free tier)

1. Push this whole `college-app` folder to a GitHub repo.
2. Go to https://render.com → New → **Web Service** → connect your repo.
3. Set **Root Directory** to `backend`.
4. Build command: `npm install`  |  Start command: `npm start`.
5. Add environment variables (from your `.env`): `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `CLIENT_ORIGIN` (set this to your frontend's deployed URL once you have it, e.g. `https://arnabs-assistant.vercel.app`).
6. Deploy. Render gives you a URL like `https://arnabs-assistant-backend.onrender.com`.
7. If you haven't already run `npm run migrate` locally against this Neon database, do that once — the tables need to exist before the app works.

*(Railway works the same way if you prefer it — new project from repo, root directory `backend`, same env vars.)*

> Free Render services sleep after inactivity and take ~30s to wake up on the next request — normal for free hosting, not a bug.

---

## 5. Deploy the frontend (Vercel, free tier)

1. Go to https://vercel.com → New Project → import the same repo.
2. Set **Root Directory** to `frontend`.
3. Framework preset: Vite (auto-detected).
4. Add environment variable: `VITE_API_URL` = `https://arnabs-assistant-backend.onrender.com/api` (your Render URL from step 4, with `/api` at the end).
5. Deploy. Vercel gives you a URL like `https://arnabs-assistant.vercel.app`.
6. Go back to Render and update `CLIENT_ORIGIN` to that exact Vercel URL, then redeploy the backend so CORS allows it.

You now have a live, free, full-stack app you can open from your phone or laptop.

---

## Features included
- **Auth** — register/login with JWT, password hashing
- **Attendance (day-wise)** — mark each whole day present, absent, half-day, or **no college** (holiday); the percentage is calculated only over actual college days — holidays are structurally excluded, not just hidden; live percentage ring; "days needed" / "safe to miss" calculator against your attendance goal (default 75%, editable via the API)
- **College holidays** — mark a date as "no college" manually, or upload a photo/PDF of your college's holiday list and every date on it gets marked automatically; holiday days show as a small, unobtrusive "Off" tag on the calendar (not a full row) with a toggle to hide that tag entirely if you want a cleaner view
- **To-do → Calendar** — type a note like *"submit assignment fri"* or *"lab report tomorrow"* and it's automatically placed on the right day in a planner view; explicit dates (`2026-08-12`, `25/07`) also work; the calendar window auto-extends to show far-out items like exams
- **Exam timetable upload** — upload a photo or PDF of your exam schedule, optionally list which courses you're taking; Gemini reads it and auto-adds each exam to your calendar and a dedicated exam list
- **Grades** — upload a semester grade card (photo or PDF); Gemini extracts course/credits/grade, and the app computes SGPA per semester and overall CGPA
- **AI chat assistant** — on the dashboard, ask questions about your attendance, tasks, exams, or anything else; it has context on your current data
- **Timetable** — weekly class schedule linked to your subjects
- **Focus timer** — Pomodoro (25/5/15) with a progress ring
- **Dashboard** — task streak, attendance streak, today's pending items, upcoming exams, attendance ring, and the chat assistant
- **View-only link** — from the dashboard, copy a private bookmarkable link (`/view/<token>`) that shows attendance and calendar with zero editing controls and no login required — handy for checking your own data quickly on any device. Regenerate it anytime to invalidate the old one.
- **Mobile-first UX** — below 720px width, the sidebar is replaced by a native-feeling bottom tab bar (Home, Attendance, Calendar, Classes, More), with a slide-up sheet for the less-frequent pages plus the theme toggle and logout. Tap targets are sized for touch, inputs are 16px on mobile to avoid iOS's auto-zoom-on-focus, the timetable collapses from 7 columns to a stacked list, and long text (course names, exam titles) wraps instead of overflowing.
- **Live theme switch** — Ink (dark) and Parchment (light), persisted locally

## Notes on the AI features
- Gemini can occasionally misread a messy scan — always double-check auto-added exam dates and grades before relying on them.
- File uploads (exam timetables, grade cards) are capped around 15MB by the server; a clear phone photo or PDF is plenty.
- The `GEMINI_MODEL` env var defaults to `gemini-2.5-flash`; change it in `.env` if you want a different Gemini model.

## Ideas for what to add next
- Push/email reminders for tasks due today
- Recurring tasks (weekly lab reports, etc.)
- Export/import your data as JSON
- Make it an installable PWA for offline use
- Expense/budget tracker for hostel spending
