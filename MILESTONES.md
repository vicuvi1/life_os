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

---

## Milestone 5 — Sessions (timed blocks + quality ratings)

**Purpose.** Turn the day into a real schedule. Tasks say *what* to do; sessions
say *when*. This is the first building block of the Smart Calendar (Milestone
21): timed study/workout/deep-work blocks with a quality score, so the app can
later learn which hours of your day produce your best work.

**How it works.**
- A new Firestore collection, **sessions**, stores each block: title, category
  (study, workout, deep work, admin, personal, other), an optional **link to a
  goal**, the date, start/end times (stored as minutes since midnight), a
  status (planned / done / skipped), an optional **quality rating 1–10** given
  after completion, and notes.
- **Conflict detection** runs on the client: any two sessions on the same day
  whose time ranges intersect are flagged with a red "Overlaps" badge, and the
  day header shows how many blocks collide.
- Each category has a signature color (study = blue, workout = red, deep work =
  green, admin = orange, personal = purple), used consistently on the Sessions
  page, the Calendar, and the Dashboard.
- Security rules: sessions are owner-scoped like every other collection —
  publish the updated `firestore.rules` for this milestone to work.

**Features.**
- Sessions page (`/sessions`): plan any day with ← / → day navigation, add /
  edit / delete blocks, and per-day totals (hours planned, hours done).
- **Mark done → rate quality**: completing a session immediately offers a 1–10
  quality rating (how good was the study block?), which is saved for future
  analytics.
- Mark skipped for honesty (skipped blocks show struck-through and dimmed).
- Overlap warnings whenever two blocks collide.
- **Calendar integration**: month cells show a colored dot per session, and the
  selected-day panel lists that day's schedule with time ranges and quality.
- **Dashboard integration**: a "Today's Schedule" section shows today's blocks
  in time order with their status.

**How to use.**
1. Open **Sessions** and click **New session** — e.g. "Spanish study", Study,
   7:00–9:00, linked to your C1 English goal.
2. Repeat for the rest of your day (Linux 9–11am, gym 4pm…). Overlaps get
   flagged instantly.
3. After finishing a block, open its menu → **Mark done**, then enter a
   quality score (1–10) in the dialog that opens.
4. Check the **Dashboard** each morning for today's schedule, and the
   **Calendar** to see your blocks across the month.

> **Note:** requires publishing the updated `firestore.rules` (adds the
> `sessions` collection) in the Firebase Console.

---

## Milestone 6 — Sleep Tracking

**Purpose.** Sleep is the single biggest lever on focus and study quality — the
Dependency Tracker spec puts it first ("Sleep 5h → everything crashes; 7–8h →
peak"). Logging it is the foundation for energy forecasts, day-quality scoring,
and the "⚠️ low sleep" alerts the Smart Calendar will show.

**How it works.**
- A new **sleepLogs** collection stores one entry per night, keyed by the
  morning you woke up (`userId_date`), so re-opening a day edits the same entry
  (no duplicates). Each entry holds hours slept, a quality score (1–10), and
  notes.
- Two simple ratings turn raw numbers into meaning: **hours** (7–9h = Good,
  6–7h = Okay, under 6h = Low) and **quality** (8+ Excellent, 6–7 Good, 4–5
  Low, under 4 Poor).
- Security rules: sleep logs are owner-scoped — publish the updated
  `firestore.rules` for this milestone.

**Features.**
- Sleep page (`/sleep`): log any night with ← / → day navigation; edit past
  nights by tapping them in the history list; delete entries.
- A running **7-day average** shown in the page subtitle.
- History list with Good/Okay/Low and quality badges per night.
- **Dashboard**: a "Last night" stat card showing your most recent sleep.
- **Insights**: an "Avg sleep (7d)" stat plus a **14-night bar chart**
  color-coded green/amber/red by how much you slept.

**How to use.**
1. Each morning, open **Sleep** and enter hours slept and a 1–10 quality, then
   **Save**.
2. Missed a day? Use ← to go back and log it, or tap any night in the history
   list to edit it.
3. Watch the **Insights → Sleep** chart — long green bars are the goal; red
   bars flag the nights that will drag your focus down.

> **Note:** requires publishing the updated `firestore.rules` (adds the
> `sleepLogs` collection) in the Firebase Console.

---

## Milestone 7 — Nutrition & Water

**Purpose.** Two of the biggest daily energy levers from the Dependency Tracker
spec are **hydration** and **eating breakfast** ("skip breakfast → −15% study
quality; <6 glasses water → headaches, −10%"). This milestone makes both a
one-tap daily log so the app can later correlate them with focus and study
quality.

**How it works.**
- A new **nutritionLogs** collection stores one entry per day
  (`userId_date`): glasses of water, a water goal (default 8), whether
  breakfast / lunch / dinner were eaten, optional total calories, and notes.
- Everything **auto-saves** — tapping a glass or checking a meal writes
  immediately (no Save button); calories and notes save when you click away.
- A hydration rating (Hydrated / Almost / Low) is derived from glasses vs your
  goal.
- Security rules: nutrition logs are owner-scoped — publish the updated
  `firestore.rules`.

**Features.**
- Nutrition page (`/nutrition`): a water counter with +/− and a tappable row of
  glass icons, an adjustable daily goal, breakfast/lunch/dinner check-offs,
  optional calories, and notes — all per day with ← / → navigation and a
  recent-days history.
- **Dashboard**: a water quick-add card — log a glass in one tap without
  leaving the morning view.
- **Insights**: an "Avg water (7d)" stat card.

**How to use.**
1. Through the day, tap **+** on the dashboard water card (or a glass on the
   Nutrition page) each time you drink.
2. Check off meals as you eat them; breakfast especially matters for focus.
3. Review your weekly water average on **Insights**; aim to hit your goal most
   days.

> **Note:** requires publishing the updated `firestore.rules` (adds the
> `nutritionLogs` collection) in the Firebase Console.

---

## Milestone 8 — Dependency Tracker

**Purpose.** Reveal the *cause-and-effect* the Dependency Tracker spec is all
about: "Why was my study quality 5/10 yesterday? → you slept 5h and skipped
breakfast." It connects the inputs you now log (sleep, water, breakfast) to the
outcome that matters (how well your study sessions actually went).

**How it works.**
- No new data or collections — it's **pure analysis** over sleep logs, nutrition
  logs, and sessions. (So there are **no new Firestore rules** to publish.)
- The daily **outcome** is your "study quality": the average quality score of
  that day's completed, rated sessions.
- For each **factor** (slept 7h+, good sleep quality, ate breakfast, hit water
  goal) it compares your average study quality on the days the factor was true
  vs. false, and reports the difference — e.g. "Ate breakfast: 8.2 vs 6.5,
  **+1.7**". Only days that have both a known factor value and a rated session
  count, and small samples are labelled as such.
- Each recent day gets a 0–100 wellbeing score (Great / Good / Mixed / Rough)
  and a plain-language explanation ("Slept enough, ate breakfast; but
  under-hydrated").

**Features.**
- Dependencies page (`/dependencies`): a highlighted **"biggest lever"** insight
  (the factor with the largest positive effect and enough evidence), a grid of
  **factor comparison cards** with deltas and sample sizes, and a **recent-days
  breakdown** with scores, explanations, and the day's raw signals.
- Honest about data: shows a "keep logging" prompt until there are enough rated
  days to compare, and never claims a correlation it can't support.

**How to use.**
1. Keep logging **sleep** and **nutrition**, and mark **sessions** done with a
   quality score — these three feed the analysis.
2. Open **Dependencies** to see which factor is currently helping you most, and
   which days went well or poorly and why.
3. Act on the "biggest lever" — usually protecting sleep or breakfast — and
   watch the deltas as more days accumulate.

---

## Milestone 9 — Time Audit & Focus Analytics

**Purpose.** The Time Audit spec asks two questions: *where does my time go?*
and *when am I actually at my best?* This milestone answers both from real data
— no self-reported energy numbers. (Energy check-ins were intentionally
skipped; instead, peak-performance time is derived from your actual session
quality by hour.)

**How it works.**
- Pure analysis over your **sessions** (no new collection or rules). "Time
  spent" counts only sessions you marked **done**.
- **Time by category** sums done-minutes per category (study, workout, deep
  work, …) over the selected range.
- **When you focus best** groups completed, rated sessions into time-of-day
  buckets (Early 5–9am, Late morning, Afternoon, Evening, Night) and computes
  the average quality in each — surfacing your real peak block (needs 2+
  sessions in a block before it's called a "best").
- **This week vs last** compares done-minutes across ISO weeks with a % change.

**Features.**
- Time Audit page (`/time-audit`) with a 7 / 30 / 90-day range toggle:
  - total tracked hours,
  - a color-coded **time-by-category** bar breakdown,
  - a **best-focus-time** callout plus per-bucket quality bars,
  - a **week-over-week** study-time trend.
- Honest empty/low-data states — it won't name a "peak block" without enough
  rated sessions.

**How to use.**
1. Plan and complete **Sessions** (with quality ratings) as you work.
2. Open **Time Audit** to see how your hours split across categories and which
   part of the day gives you the best focus.
3. Move your hardest work into your peak block, and watch the weekly trend to
   see whether your total focused time is climbing.

---

## Milestone 10 — Expense Tracker + Budget

**Purpose.** Know exactly where money goes and stay on budget — the Expense
Tracker spec's goal of "see $50/week on junk → cut it → save $1,300/year."
Built for a student watching every leu/dollar.

**How it works.**
- Two new collections: **expenses** (amount, category, note, date) and
  **budgets** (one doc per user: currency symbol, a monthly total, and optional
  per-category caps).
- Everything is grouped **by month**; you navigate months with ← / →.
- The **projection** is pace-based for the current month (spend-so-far ÷
  days-elapsed × days-in-month), and simply the actual total for past months —
  so it never shows a fake forecast for a finished month.
- Alerts fire two ways: a red **over-budget** banner, and an amber **on-pace-to-
  overspend** warning when the projection exceeds the budget.
- Security rules: expenses and budgets are owner-scoped — publish the updated
  `firestore.rules`.

**Features.**
- Expenses page (`/expenses`): month navigation, a summary (spent vs budget,
  amount left/over, days remaining, projected month-end), a budget progress bar
  that turns amber/red as you approach/exceed the cap.
- **By-category breakdown** with bars; if you set a per-category limit the bar
  measures against it and turns red when exceeded, otherwise it shows each
  category's share of the month.
- Add / edit / delete expenses; a **budget settings** dialog for the currency,
  monthly total, and per-category limits.

**How to use.**
1. Open **Expenses → the gear icon** and set your currency and a monthly budget
   (and per-category limits if you like).
2. Tap **Add** whenever you spend — amount, category, optional note.
3. Watch the summary: the projection and amber warning tell you early if you're
   on track to overspend, so you can adjust before month-end.

> **Note:** requires publishing the updated `firestore.rules` (adds the
> `expenses` and `budgets` collections) in the Firebase Console.

---

## Design refresh — polished UI

**Purpose.** Make Life OS feel like a premium, cohesive product rather than a
default template, and tame the now-long navigation.

**What changed.**
- **Refined theme**: a richer dark palette with slightly elevated cards, a
  softer violet accent, larger corner radius, a subtle violet depth-glow in the
  background, custom thin scrollbars, and nicer text selection.
- **Sectioned sidebar**: navigation is grouped into **Plan**, **Track**, and
  **Review** with small section labels, so 15 destinations stay scannable. The
  active item gets a left accent bar and tinted pill; a gradient app logo sits
  up top and your account (initial + email) sits in the footer.
- **Matching mobile menu**: the slide-in drawer mirrors the same sections and
  branding, with a blurred backdrop.
- **Dashboard**: the greeting is now a gradient hero banner, and the stat cards
  have gradient icon chips and a gentle hover lift.
- A reusable `card-interactive` hover style for clickable cards.

No data or behaviour changed — this is purely visual.

---

## Milestone 11 — Meal Prep + Shopping List

**Purpose.** Kill the daily "what should I eat?" decision and the time wasted at
the shop. Plan a week of meals from a reusable library, and let the app roll the
ingredients into one de-duplicated shopping list — the Meal Prep spec's "Sunday
1 hour = all meals planned + shopping done."

**How it works.**
- **meals** collection: a reusable library, each meal tagged to a slot
  (breakfast/lunch/dinner) with an ingredient list and optional estimated cost.
- **mealPlan** collection: one entry per date + slot (deterministic id
  `userId_date_slot`), so assigning/clearing a day's meal is a single write.
- **shoppingChecks** collection: per-week (`userId_weekStart`) state holding
  which items you've ticked off and any extras you added by hand.
- The shopping list is **generated**, not stored: it flattens the week's planned
  meals' ingredients, de-duplicates case-insensitively (showing a ×N when an
  item is needed for several meals), and merges in your manual extras.

**Features.**
- Meals page (`/meals`) with week navigation:
  - A **7-day planner** (one card per day, a dropdown per slot) — pick a meal
    and it's saved instantly.
  - An **auto shopping list** with tick-off (persisted per week), an estimated
    cost total, a checked/total counter, and an "add item" box for one-offs.
  - A **meal library** to add / edit / delete your go-to meals.

**How to use.**
1. Add a handful of meals (**New meal**) with their ingredients.
2. For the week, pick a meal in each day's breakfast/lunch/dinner dropdown.
3. Shop straight from the generated list, ticking items as you go; add anything
   extra (olive oil, snacks) with the add box.

> **Note:** requires publishing the updated `firestore.rules` (adds the
> `meals`, `mealPlan`, and `shoppingChecks` collections) in the Firebase
> Console.

---

## Milestone 12 — Decision Eliminator (Routines)

**Purpose.** Every day you make dozens of trivial decisions ("what do I wear?",
"when's laundry?") and each one drains mental energy. The Decision Eliminator
spec's idea is to **pre-decide once and just execute** — freeing your focus for
what matters.

**How it works.**
- A single **decisions** config doc per user (`doc id = userId`) holds an outfit
  for each weekday and a list of fixed defaults (label → value).
- The page derives **today's** outfit from the current weekday, so the morning
  view needs zero thought.
- Saving fully replaces the config (no stale entries from deep-merge).
- Security rules: owner-scoped — publish the updated `firestore.rules`.

**Features.**
- Routines page (`/routines`):
  - A **Today** hero showing the outfit pre-decided for the current weekday.
  - **Your defaults** — a clean list of fixed decisions (wake time, bedtime,
    entertainment limit, laundry day, …).
  - **Outfits this week** — all seven days at a glance, today highlighted.
  - An **Edit** dialog to set the 7 outfits and add/remove any number of
    defaults.

**How to use.**
1. Open **Routines → Edit** and fill in an outfit for each day plus your fixed
   defaults.
2. Each morning, glance at **Today** — wear what it says, follow your defaults.
   No deciding.

> **Note:** requires publishing the updated `firestore.rules` (adds the
> `decisions` collection) in the Firebase Console.

---

## Maintenance — Meal Prep review fixes

Follow-up hardening for Milestone 11 from the adversarial review:
- Editing a meal's slot no longer orphans its planned days — a still-assigned
  meal stays selectable in its cell even if its slot changed, so it can't become
  an invisible "phantom" that silently inflates the shopping list.
- Deleting a meal now cascade-deletes its meal-plan entries (no dangling docs).
- The per-week shopping-check fetch is guarded against out-of-order responses,
  and the meal library/plan load once per user instead of on every week change.
