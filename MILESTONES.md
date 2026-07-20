# Life OS — Milestones & Release Notes

This is the living record of everything built into Life OS. Each milestone below
explains **what it is**, **why it exists (purpose)**, **how it works under the
hood**, the **features** it adds, and **how to use it**.

This file lives on GitHub and is also readable inside the app at
**Settings → Milestones & release notes**. It is updated every time a new change
ships.

**Tech stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Firebase
Authentication · Cloud Firestore · deployed on Vercel.

---

## Milestone 1 — Foundation (Auth · Dashboard · Theme)

**Purpose.** Give Life OS a secure, fast, good-looking shell so that everything
else has something to plug into. When you open the app at 6am it should load
instantly, know who you are, and show a clean dashboard.

**How it works.**
- **Authentication** uses Firebase Auth (email + password). A React context
  (`AuthProvider`) listens to Firebase's `onAuthStateChanged` and exposes the
  current user, plus `signIn`, `signUp`, and `signOut` to the whole app.
- **Route protection** is handled client-side by layout guards: the `(app)`
  group redirects to `/login` if you're signed out; the `(auth)` group redirects
  to `/dashboard` if you're already signed in. Your session persists across
  refreshes automatically.
- **Theme** is powered by `next-themes` with dark mode as the default. Your
  choice is saved to the browser's local storage and restored on next visit.
- **Data security** is enforced by Firestore Security Rules: every record is
  tagged with your user id, and the rules only let you read or write your own
  data.

**Features.**
- Email/password sign up (with confirm-password) and login, with friendly error
  messages.
- Persistent login across page refreshes.
- Dark/light theme toggle (dark by default).
- Responsive app shell: a sidebar on desktop, a slide-in hamburger menu on
  mobile, and a top bar with your email, theme toggle, and logout.
- A morning dashboard scaffold with sections for goals, today's focus, habits,
  and quick stats — each with a clean empty state.
- Settings page showing your account, a theme toggle, and logout.

**How to use.**
1. Open the app and **Sign up** with your email and a password (min 6 chars).
2. You land on the dashboard. Refresh — you stay logged in.
3. Toggle the theme with the sun/moon button (top-right). It sticks.
4. On mobile, tap the menu icon to open navigation.
5. Log out from the top bar or from **Settings**.

---

## Milestone 2 — Goals, Projects & Tasks (with auto-progress)

**Purpose.** Turn vague ambitions into an execution system. You keep a small set
of goals, break each into projects, and break projects into daily tasks — and the
app tracks how far along each goal is, automatically.

**How it works.**
- Three linked Firestore collections: **goals → projects → tasks**. Projects
  belong to a goal; tasks belong to a goal (and optionally a project).
- **Auto-calculated progress** is the core mechanic: a goal's progress % equals
  the share of its tasks marked done. Every time you add, complete, un-complete,
  or delete a task, the goal's progress is recomputed and saved. It shows up
  everywhere the goal appears (goal cards, detail page, dashboard, insights).
- **Cascade delete**: deleting a goal removes its projects and tasks; deleting a
  project removes its tasks. Firestore has no foreign keys, so this is done with
  a batched write.

**Features.**
- Goals: create / edit / delete with title, description, status (active, paused,
  completed, archived), priority (high/medium/low), category, quarter, and
  deadline. Cards show a live progress bar, status/priority badges, and a
  "days left" countdown.
- Goal detail page: add **projects** (each with its own status), and add
  **tasks** either under a project or directly on the goal.
- Tasks: title, description, priority, and due date. One-tap complete via a
  checkbox; edit and delete from a menu.
- Tasks page: a global list with a **quick-add** box and **Today / Open / All**
  filters.
- Projects page: all your projects grouped under their goal.
- Dashboard "Today's Focus" shows your real open tasks, soonest-due first, and
  you can check them off in place.

**How to use.**
1. Go to **Goals → New goal**, fill in the details, and create it.
2. Open the goal (click its title or "Open projects & tasks").
3. **Add project** to create a milestone, then **Add task** under it (or add a
   task straight to the goal).
4. Check off tasks as you finish them — watch the goal's progress bar move.
5. Use the **Tasks** page for a fast daily view and quick-add; use **Projects**
   for a bird's-eye view.

---

## Milestone 3 — Habits & Streaks

**Purpose.** Build momentum with daily habits. Consistency compounds, so the app
makes it satisfying to keep a streak alive and painful to break one.

**How it works.**
- Two collections: **habits** and **habitLogs**. Each check-in creates a log
  with a deterministic id (`habitId_date`), so marking a habit done twice on the
  same day is impossible (it's idempotent).
- **Streak math** is recomputed from your real log history on every toggle:
  - *Current streak* = consecutive completed days ending today (or yesterday, so
    a streak doesn't break until you miss a full day).
  - *Best streak* = the longest run you've ever had.
- The dashboard and habits page read your logs and derive today's completion, the
  current streak, best streak, and a 7-day mini-history entirely on the client.

**Features.**
- Habits: create / edit / delete with a category (morning, evening, exercise,
  learning, health), a color (8-swatch picker), and frequency (daily/weekly).
- One-tap daily check-in with instant (optimistic) feedback in your habit's
  color.
- Current streak 🔥 and best streak 🏆 shown per habit.
- A 7-day mini history of colored squares next to each habit.
- A "X/Y done today" summary at the top of the Habits page.
- Dashboard "Today's Habits" is fully checkable from the morning view.

**How to use.**
1. Go to **Habits → New habit**, name it, pick a category and color, and create.
2. Each day, tap the checkbox to mark it done. The streak counter ticks up.
3. Keep the streak going — miss a day and the current streak resets, but your
   best streak is remembered.
4. Check habits off directly from the **Dashboard** too.

---

## Milestone 4 — Weekly Review, Calendar & Insights

**Purpose.** Close the loop. Milestone 4 adds reflection (weekly review), time
awareness (calendar), and feedback (analytics) so you can see whether the system
is actually working and adjust.

**How it works.**
- **Weekly Review** stores one document per week (keyed by the Monday that starts
  the week), so revisiting a week loads and updates the same review.
- **Calendar** reads all your tasks and buckets them by due date into a month
  grid built around ISO weeks (Monday-first).
- **Insights** loads goals, tasks, habits, and habit logs, then derives all
  metrics on the client — no extra storage, no external chart library. The
  heatmap and bar chart are drawn with plain HTML/CSS so the app stays light.

**Features.**
- **Weekly Review** (`/review`): a per-week template — what went well, what got
  in the way, next week's focus, and a 0–100 score. Navigate weeks with ← / →,
  and browse a history list of past reviews (color-coded by score).
- **Calendar** (`/calendar`): a month grid of tasks by due date, with a per-day
  count badge (open tasks, or ✓ when all done). Click a day to see its tasks;
  today is highlighted; jump back with the **Today** button.
- **Insights** (`/insights`):
  - Stat cards: average goal progress, task completion %, this week's habit
    check-in rate, and best streak.
  - A 14-day task-completion bar chart.
  - A GitHub-style habit consistency heatmap (13 weeks; darker = more habits
    completed that day).
  - Per-goal progress bars.

**How to use.**
1. Each Sunday/Monday, open **Weekly Review**, fill in the three prompts and a
   score, and **Save**. Use ← / → to review past weeks.
2. Open **Calendar** to see what's due and when; click a day for its task list.
3. Open **Insights** to see trends — is your completion rate climbing? Are your
   habits consistent? Adjust your focus accordingly.
