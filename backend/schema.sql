-- Run this against your Neon database via `npm run migrate`.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  attendance_goal INTEGER NOT NULL DEFAULT 75,
  view_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- For accounts created before this feature existed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS view_token TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#C9A227',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Old per-subject attendance table is no longer used — attendance is day-wise now.
DROP TABLE IF EXISTS attendance_records CASCADE;

CREATE TABLE IF NOT EXISTS day_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'half_day')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  date DATE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent')),
  done BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'exam', 'ai')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  room TEXT NOT NULL DEFAULT '',
  class_name TEXT NOT NULL DEFAULT '1st Year',
  instructor TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE timetable_slots ADD COLUMN IF NOT EXISTS class_name TEXT NOT NULL DEFAULT '1st Year';
ALTER TABLE timetable_slots ADD COLUMN IF NOT EXISTS instructor TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course TEXT NOT NULL,
  exam_date DATE NOT NULL,
  exam_time TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grade_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  semester TEXT NOT NULL,
  course TEXT NOT NULL,
  credits NUMERIC NOT NULL,
  grade TEXT NOT NULL,
  grade_points NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS college_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'upload')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC;

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  category TEXT NOT NULL DEFAULT 'other',
  merchant TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'upload')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  direction TEXT NOT NULL CHECK (direction IN ('owed_to_me', 'i_owe')),
  note TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  settled BOOLEAN NOT NULL DEFAULT false,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'free_trial' CHECK (plan_type IN ('free_trial', 'paid')),
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT '₹',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly', 'one_time')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  renewal_date DATE NOT NULL,
  remind_days_before INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'paused')),
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- For DBs created before subscription reordering existed (previously ensured at
-- request time in routes/subscriptions.js; now part of the migration).
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS nptel_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_name TEXT NOT NULL,
  duration_weeks INTEGER NOT NULL DEFAULT 8,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  assignment_due_day INTEGER NOT NULL DEFAULT 3, -- 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  exam_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- For DBs created before NPTEL course reordering existed (previously ensured at
-- request time in routes/nptel.js; now part of the migration).
ALTER TABLE nptel_courses ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS nptel_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES nptel_courses(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  submitted BOOLEAN NOT NULL DEFAULT false,
  score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id);
-- (user_id, date) covers plain user_id lookups AND the date-range + ORDER BY date
-- queries in routes/attendance.js, plus the dashboard and attendance-summary reads.
CREATE INDEX IF NOT EXISTS idx_day_attendance_user_date ON day_attendance(user_id, date);
DROP INDEX IF EXISTS idx_day_attendance_user;
CREATE INDEX IF NOT EXISTS idx_todos_user_date ON todos(user_id, date);
CREATE INDEX IF NOT EXISTS idx_timetable_user ON timetable_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_exams_user ON exams(user_id, exam_date);
CREATE INDEX IF NOT EXISTS idx_grades_user_sem ON grade_entries(user_id, semester);
CREATE INDEX IF NOT EXISTS idx_holidays_user ON college_holidays(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_debts_user ON debts(user_id, settled);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_nptel_courses_user ON nptel_courses(user_id);
CREATE INDEX IF NOT EXISTS idx_nptel_assignments_course ON nptel_assignments(course_id, due_date);
-- (user_id, due_date) serves the user-scoped assignment reads in routes/nptel.js and routes/ai.js.
CREATE INDEX IF NOT EXISTS idx_nptel_assignments_user_due ON nptel_assignments(user_id, due_date);
