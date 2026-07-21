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
- **Update:** fixed same-day transaction entry so the Finance page can accept both
  income and expense values for the same date, enlarged the transactions table for
  a more readable layout, made the transactions history panel vertically scrollable,
  added autosave for inline amount and note edits so values are persisted even
  if you leave the page before explicitly blurring the field, and introduced a
  compact number view so large amounts can be displayed as 1k / 1m.

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

## Design refresh v2 — modular Notion-style workspace

**Purpose.** Move the dashboard from a fixed SaaS grid toward a personal,
modular workspace — while keeping the violet-on-black identity.

**What changed.**
- **Emoji as a functional icon language**: consistent emojis for goal categories
  (📚 education, 💼 career, 🏋️ health, 💰 financial, 🌱 personal), habits, and
  section headers (📋 Focus, 🎯 Goals, 🔥 Habits, 💧 Water, 😴 Sleep), plus a
  time-of-day emoji in the greeting.
- **Expandable stat tiles**: the four headline tiles (Goals, Progress, Streak,
  Sleep) now click to reveal a breakdown inline — which goals, per-goal bars,
  top streaks, recent nights.
- **Collapsible sections**: Today's Focus, Active Goals, Habits, and Schedule
  are collapsible blocks that remember their open/closed state per section.
- **Flexible bento layout**: important blocks (Focus, Goals) span wide while the
  Water tracker sits as a compact widget; the Schedule block only appears when
  there's something scheduled, so empty trackers don't reserve equal space.
- **Modular feel**: rounded elevated cards with hover lift, subtle drag-handle
  affordances on section headers, and clear "+ add" actions.
- **Collapsible sidebar groups**: Plan / Track / Review can each be collapsed to
  hide areas you're not using; the choice is remembered.

---

## Polish pass — personal touches (low-effort tier)

**Purpose.** Small changes that change the whole tone — make it feel personal,
alive, and less like a static dashboard.

**What changed.**
- **Real name**: set a first name once (a one-time prompt on the dashboard, or
  Settings → Account → Name). Greetings and the sidebar now say "Good
  afternoon, Victor" instead of your email handle. Stored on your Firebase Auth
  profile — no new collection.
- **One thing highlighted, not four equal boxes**: a **Spotlight** card surfaces
  the single most relevant thing right now (next session, tasks left, log sleep,
  water) larger than everything else; the rest drop into a smaller "Also today"
  list.
- **Feels alive over time**:
  - a **trend arrow** on the sleep tile ("7.2h ↑ 1.1h vs avg"),
  - a **last-7-days habit strip** — seven squares showing your completion
    pattern at a glance, more motivating than a lone streak number.
- **Weekly recap surfaced on Monday**: on Mondays the dashboard shows a prompt
  to run your weekly review, instead of it being buried in the nav.
- Time-of-day greeting + icon (🌅/☀️/🌆/🌙) and "Today's Focus" already hide
  completed items rather than showing a checked-off list.

---

## Polish pass — smart session defaults

**Purpose.** Reduce typing when scheduling. The app learns your usual times from
your history and pre-fills them, so a recurring block is one tap, not a form.

**How it works.**
- `computeSessionDefaults` scans your past sessions and finds, per category, the
  **most common (start, end) block** (ties broken by most recent), the category
  you schedule most, and the usual block per **title**.
- Opening **New session** pre-fills the category and time from these patterns
  (e.g. once you've logged gym 5–6pm a few times, it defaults there).
- Changing the category snaps the times to that category's usual block, and
  typing a **title you've used before** ("Spanish") pulls in its usual category
  and time. A subtle "✨ Prefilled from your usual … time" hint shows, and it
  disappears the moment you edit a time yourself.
- Editing an existing session is untouched — it always shows that session's own
  values.

**How to use.** Just keep logging sessions normally. After a few, **New session**
will already have your typical time filled in — adjust only when it differs.

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

---

## Milestone 13 — Smart Calendar

**Purpose.** The finale: one calendar that shows your *entire* Life OS at a
glance, instead of five separate screens. This is the Smart Calendar spec — not
just appointments, but everything, customizable.

**How it works.**
- Pure aggregation over existing data (sessions, tasks, sleep, daily habits +
  logs, and goal deadlines) — **no new collection or rules**. It replaces the
  earlier basic calendar at `/calendar`.
- Everything is joined **per day** into a single view model, with session
  overlaps flagged as conflicts.
- **Toggles** let you show/hide each element type (Sessions, Tasks, Habits,
  Sleep, Deadlines); your choice is saved in the browser so the calendar always
  opens the way you like it.

**Features.**
- **Two views**: a **Month** grid with color-coded indicators per day (session
  category dots, a red deadline dot, an indigo sleep dot, an orange habits dot,
  and an open-task count) — click any day for its full agenda; and a **Week**
  view showing an agenda card per day.
- **Color-coded, unified agenda** per day: goal deadlines with countdowns, sleep
  with quality, time-ordered sessions (with ⚠ on overlaps), tasks due with
  priority, and habits completed.
- Month/Week navigation, a **Today** jump, and element toggles that persist.

**How to use.**
1. Open **Calendar**. Use the **Month / Week** switch and the toggle chips to
   show exactly what you care about (e.g. hide everything but Sessions for a
   focused study view).
2. In Month view, click a day to see its full agenda below; in Week view, scan
   all seven days at once.
3. Watch for ⚠ overlap flags on sessions and the countdown badges on goal
   deadlines to plan around conflicts and due dates.

---

## Milestone 14 — Reminders & Nudges

**Purpose.** A tracker only pays off if you actually keep it up. This adds gentle
reminders so nothing slips: what you still need to do today, surfaced where
you'll see it.

**How it works.**
- A **"Needs your attention"** panel on the dashboard is computed from data
  already loaded there — no new storage. It lists, in priority order: your next
  upcoming session, tasks due today, unlogged sleep, habits still to check off,
  and water left to hit your goal. Each links straight to the right screen.
- Optional **browser notifications**: enable them in Settings and, while the app
  is open, your top reminder is shown once per day as a native notification.

**Scope note.** True *scheduled* push (a ping when the app is closed) needs a
backend scheduler + Firebase's Blaze plan + an Admin service account, so it's
deliberately out of this milestone. Everything here works on the free plan with
no extra keys. The pieces (`lib/notify.ts`) are structured so full push can be
layered on later.

**Features.**
- Dashboard "Needs your attention" reminder center (only shows when there's
  something to do).
- Settings → **Reminders**: one-tap opt-in for browser notifications, with clear
  status (on / blocked / unsupported).

**How to use.**
1. Open the dashboard each morning — the reminder panel tells you exactly
   what's outstanding; tap any item to jump there.
2. In **Settings → Reminders**, click **Enable** to also get a native
   notification of your top nudge while the app is open.

---

## Design overhaul — Priority Stack, inline logging, Log Today, and app-wide consistency

**Purpose.** A full interaction-and-layout pass (colors/theme untouched) aimed at
one thing: reduce the number of taps between "I should log this" and "it's
logged." The dashboard's "Right now" and "Also today" cards are merged into one
ordered **Priority Stack** where simple trackers (sleep, water, habits, tasks)
can be completed **inline** — no click-through required — and a single **Log
today** button handles the whole day's quick logging in one modal.

**How it works.**
- **`lib/priority.ts`** replaces the old `lib/nudges.ts`. `buildPriorityStack`
  returns a typed, ordered list — time-sensitive nudges (Monday review) first,
  then the highest-impact unlogged metric (sleep), then remaining daily
  trackers (habits, water), then tasks due today, then an informational
  "up next" session. Each row carries exactly the data it needs to render an
  inline action.
- **A toast/undo system** (`components/ui/toast-provider.tsx`, wired into the
  root layout) replaces confirm-dialogs for reversible actions. Deleting a task
  now hides it immediately and shows a 5-second **Undo** toast; if you navigate
  away without clicking Undo, the delete still commits in the background
  (matching how "undo send" works elsewhere) rather than silently canceling.
- **Smart default for sleep**: `smartDefaultSleep` looks at your last 14 days of
  sleep logs and pre-fills the inline slider with your most frequent hours —
  a simple frequency lookup, not a model.
- **`components/ui/slider.tsx`**: a small dependency-free styled range input,
  used for the inline sleep-hours control and the Weekly Review score.
- **`components/log-today-dialog.tsx`**: one modal listing only the trackers you
  haven't logged yet today (sleep / water / habits). Each section commits the
  moment you interact with it — no separate "Save" step — and the modal
  auto-closes with a small celebration toast once everything's logged. The
  header's **Log today** button itself shows a checkmark state ("All logged")
  once there's nothing left, instead of opening an empty modal.

**Dashboard features.**
- **Priority Stack**: merges the old spotlight/"also today" split into one
  list, capped at 4 visible rows with a "+N more" expander. Sleep logs via an
  inline slider + Log button; water via the existing +/- stepper; habits via
  tappable chips; tasks due today via inline checkboxes (first 4, "+N more —
  view tasks" beyond that). The separate Water widget card is gone — water now
  lives in exactly one place.
- **Stat row auto-hides** on a brand-new account (zero goals **and** zero
  streak days) behind a single quiet line, instead of a row of four zeros.
- **Sleep trend arrow** ("7.2h ↑ 1.1h vs avg") only appears once there are 2+
  nights logged — never a fabricated flat arrow.
- **Today's Focus** is now grouped by each task's linked goal category
  (Education/Career/Health/Financial/Personal/Other), each group independently
  collapsible with its own count badge. Tasks completed **today** stay visible
  (struck through, muted) instead of vanishing the instant you check them off —
  they naturally drop off the next day since the grouping is date-based.
- **Quick Add** popover (header) creates a task or goal without leaving the
  dashboard. **Keyboard shortcuts** `n` (new task), `g` (new goal), `l` (Log
  today) work anywhere on the dashboard except while typing in a field or a
  dialog is already open; a small **?** button (bottom-right) shows the
  shortcuts list.
- Real first name, time-of-day greeting/icon, and the 7-day habit strip are
  unchanged from the previous polish pass — still correct, just re-verified.

**Weekly Review.**
- Section headers now use outline icons (party-popper / construction / target)
  instead of raw emoji, matching the rest of the app.
- The 0–100 score is now a **slider** instead of a number field.
- **Past reviews** collapse to the 3 most recent by default, with a "View all
  (N)" expander.
- **Drafts auto-save** to the browser as you type and restore automatically if
  you navigate away before clicking Save — nothing is lost.
- A **"This week"** quick-jump button appears once you've navigated to a
  different week (mirrors Calendar's "Today").

**Expenses.**
- Only one **Add expense** entry point is ever visible at once — the header
  button is hidden while the month is empty (the empty state has its own).
- A **"This month"** quick-jump button appears once you've navigated away from
  the current month.

**Calendar.**
- Filter pills now clearly show on/off state — solid filled when active,
  outline/ghost when inactive (previously both looked similar).
- The day-detail empty state is now a full headline + explanation + CTA
  ("Nothing scheduled" → "Plan a session…" → **Add a session**), matching the
  warmer pattern already used by Expenses, instead of a single terse line.

**Scope decisions (called out for transparency).**
- **Icon language:** an earlier pass in this project deliberately introduced
  emoji as a functional icon language across goal/habit categories and
  dashboard section headers, per explicit request. This redesign asked for
  "one icon language app-wide, standardize on outline icons since nav already
  commits to them" — I applied that specifically to **Weekly Review** (the
  page actually named as inconsistent), and left the dashboard's intentional
  emoji language as-is rather than reverting a different, already-shipped
  request. Worth a conscious look together if the goal is a single icon
  language everywhere.
- **Confirm dialogs** are still used for goal/project/habit/session/meal/expense
  deletion — these cascade-delete related data (projects+tasks, habit history,
  meal-plan entries, etc.), so they stay in the "genuinely destructive"
  category the spec carves out. Only task deletion (called out explicitly, and
  the lowest-stakes of the bunch) moved to undo-toast.
- **Log Today** commits each section the moment you interact with it (matching
  the rest of the app's "no separate Save step" pattern) rather than having one
  global Submit button — functionally equivalent ("update your day in one
  place, under 15 seconds") but worth knowing if you expected a single button.

---

## Flexibility overhaul — type any number, edit any target, track anything

**Purpose.** The biggest redesign pass yet, with one governing rule: **every
number in the app is directly typeable, nothing is hardcoded, and every tracker
adapts to how you actually use it.** Sliders and +/- steppers everywhere became
shortcuts layered on top of real number fields — never a replacement for one.

**Core changes.**
- **NumberField everywhere** (`components/ui/number-field.tsx`): a compact
  type-anywhere input — decimals where sensible (6.5h sleep, 1.5 L water),
  commit on blur/Enter, revert on Escape, never a request per keystroke.
  Wired into: the sleep row (slider + field), water (stepper + field + editable
  target), the Log Today modal, the Weekly Review score (slider + field),
  goal count/manual progress, habit targets, tracker logging, wardrobe cost /
  times-worn.
- **Editable targets inline**: the water goal is a clickable number right where
  it's shown (dashboard row and Nutrition page), habit targets are set per
  habit, tracker targets per tracker, budget caps in the budget dialog. Water
  **units are configurable** (glasses / liters / oz) on the Nutrition page.
- **Custom trackers** (`/trackers`, in the Track nav group): define your own
  metric — name, type (number / count / duration / yes-no), unit, optional
  daily target, and an icon. Custom trackers appear as **equal citizens**: in
  the Priority Stack, the Log Today modal, dashboard stat tiles, and their own
  14-day Insights charts. Reorder (up/down), hide, or archive any tracker —
  and hide built-ins (Sleep / Water / Habits) you don't use.
- **Flexible goal progress**: percentage (auto from tasks — unchanged), **count
  toward a target** ("500 / 2000 $ saved", shown with its unit everywhere), or
  **manual** (you set the % with a slider + number field). Task auto-calc never
  clobbers count/manual goals.
- **Flexible habits**: yes/no checkbox, **count with target** (8 glasses), or
  **duration** (30 min) — chosen per habit. Measured habits get an inline
  today-value field; streaks only count a day once the target is reached.

**Also in this pass.**
- **Currency selector in Settings** — including **MDL (Moldovan leu)**, plus
  USD/EUR/GBP/RON/UAH/PLN/CHF, with correct symbol placement ("120 L" vs
  "$120"). Changes apply everywhere money is shown; existing amounts keep
  their numbers (symbol switch, no conversion).
- **Wardrobe** (on Routines): clothing items with **uploaded photos** —
  client-side center-crop to square + compression (stored inline in Firestore,
  keeping the free plan), an image-first grid, text tags with filter pills,
  cost / times-worn fields, and a "Wear today" counter. Images lazy-load.
- **Insights fixes**: the tasks chart never renders as a blank box (sized
  empty state with CTA), zero-value stats are dropped from the top row instead
  of shown at equal weight, every chart header **links through** to its source
  page, custom-tracker charts render like built-ins, chart data is
  **session-cached** (60s TTL) so navigating back doesn't refetch, and loading
  shows **skeletons**, not blank flashes.
- **One onboarding card** on a fresh account (add a goal / task / habit, or
  dismiss) instead of four stacked empty-state nudges.
- **Icons standardized to outline (lucide) everywhere** — the dashboard's emoji
  section headers, stat tiles, greeting, and category markers are now outline
  icons; `lib/emoji.ts` was removed.
- **Motion**: checkmark pop on completing tasks/habits, priority-stack rows
  collapse out when completed, animated count-up on stat numbers, fade-slide
  on new cards — all respecting `prefers-reduced-motion`.
- **Performance**: dashboard loads all data in one parallel batch; logging is
  optimistic (UI first, sync in background, rollback on failure); number
  fields commit on blur (no per-keystroke writes).
- Smart-default prefills (sleep hours, tracker targets) now render **muted
  and italic** until you touch them, so a suggestion never looks like an
  already-saved value.

> **Note:** requires publishing the updated `firestore.rules` — this pass adds
> the `trackers`, `trackerLogs`, `clothing`, and `prefs` collections.

**Follow-up — remaining gaps closed.**
- **Sleep goal**: a configurable nightly target (default 8h) edited inline on
  the Sleep page; the Good/Okay/Low ratings now grade against *your* goal
  instead of a fixed 7–9h band.
- **Week-score scale is configurable**: rate weeks out of **/10 or /100**
  (selector next to the score). Stored values stay normalized so history
  remains comparable and past badges re-render in your chosen scale.
- **Custom trackers can now be hidden** (eye toggle) as well as archived —
  hidden keeps the tracker and its chart but removes it from the daily flow.
- **Task checkboxes are optimistic**: they flip instantly and sync in the
  background, rolling back only if the save fails.
- **Skeleton loading everywhere**: all 16 remaining pages traded their center
  spinners for content-shaped skeletons.
- **List-entry transitions** extended to task, habit, session, and expense
  rows.

---

## Brand — custom logo

**Purpose.** Replace the generic rocket icon with a distinctive, on-brand mark.

**What it is.** A gradient (violet → fuchsia) rounded-square badge containing an
**orbit ring** with an upward **growth line** whose endpoint lands exactly on
the ring, tipped with a node dot — reads as *system + momentum + progress*,
which is what Life OS is. It's a self-contained SVG (`components/logo.tsx`, no
image assets) used in the sidebar, the mobile menu, and the login/signup screen,
and the same mark is the **browser-tab favicon** (`app/icon.svg`). Colors match
the existing theme exactly, so nothing else about the look changes.

---

## Career — Certification progress in the sidebar

**Purpose.** Give you a one-glance answer to "how are my certifications going?"
right in the sidebar — progress, the next exam and how many days away it is, and
whether you're on pace — without opening the Goals page or doing any mental math.

**What it is.** A new **Career** section at the bottom of the sidebar (and the
mobile menu) that lists each certification you're working toward, e.g.:

```
CAREER
├─ CCNA          72% · 14/50 modules   Oct 15 · 63d   [On track]
├─ C1 English    54%                    Nov 30 · 104d  [On track]
└─ Linux         45%                                   [In progress]
```

**How it works.**
- A certification is simply a **Goal tagged with the new "Certification"
  category** — there's no separate certification record and no new form to fill
  in. Tag a goal once (Goals → New/Edit goal → *Category: Certification*) and it
  appears here automatically.
- Everything shown is **derived from the goal**, in keeping with the app's
  auto-calc philosophy:
  - **Progress %** is the goal's existing progress (auto from completed tasks for
    percent goals, from current/target for count goals, or your manual value).
  - **"14/50 modules"** shows only for *count* goals, using the goal's
    current/target values and its unit label.
  - **Exam date + countdown** ("Oct 15 · 63d") come from the goal's **deadline**.
  - **Status** is computed by comparing your actual progress against the pace
    implied by the timeline (goal created → exam date): **On track** when you're
    within ~10 points of the expected pace, **Behind** when you've slipped
    further, **Overdue** once the exam date has passed, **Done** at 100% or when
    the goal is completed, and **In progress** when there's no exam date to pace
    against.
- The section **only appears when you have at least one certification**, so it
  never clutters the nav for users who don't track any. It's collapsible on
  desktop (state remembered), and refreshes as you navigate so edits show up
  without a full reload. Each row links to that goal's detail page.

**How to use it.**
1. Create (or edit) a goal and set its **Category** to **Certification**.
2. For a "14/50 modules" style readout, set the goal's progress type to **Count**
   and give it a target, current value, and unit (e.g. `modules`).
3. Add a **Deadline** to get the exam date, day countdown, and on-track status.
4. Watch the **Career** section in the sidebar — it stays current on its own.

> **Note.** *Mock exam score* from the original sketch isn't included yet: the
> Goal model has no field for it, and adding one would mean extra manual entry.
> It's a natural follow-up if scored practice tracking becomes worth the input.

---

## Finance — glanceable money dashboard

**Purpose.** Replace a hand-maintained finance spreadsheet with a dashboard you
can read in 5 seconds: how much money you have, what you spent today and this
month, whether you're on track for your savings goal, where your money goes, and
what to do next. MDL-first.

**What it is.** The Finance page is a **glanceable money dashboard** designed so
that in ~5 seconds you can see how much money you have, what you spent today and
this month, whether you're on track for your savings goal, where your money is
going, and what to do next. The editable transactions grid lives below it.

**How it works.**
- **Greeting + header.** "Good morning, {name}" with the month, an account
  filter, CSV export, settings, and a prominent **Add transaction** button.
- **KPI cards.** Total net worth (with a net-worth **sparkline** and vs-last-month
  change), Wallet (cash), Safe (savings), Spent this month (+ today), and the
  Savings goal with a progress bar. Each has a colored icon chip.
- **Insights — what to do next.** Auto-generated tips: are you spending more/less
  than last month, your biggest category, "at this pace you'll hit your goal in
  ~N days," and today's net.
- **Charts.** Spending-overview **donut** (top categories with icons + %),
  **Income vs Expenses** bars with net, and a **calendar heatmap** coloring each
  day green (saved) or red (spent) — all inline SVG, no libraries.
- **Recent activity.** The latest transactions with category icons and signed
  amounts. **Monthly trend** line chart (income vs expenses across the year).
  **Quick add** buttons (Income / Expense / Transfer / Settings) and a compact
  income/expenses/net/savings-rate summary.
- **Add transaction dialog.** Add/edit via a form (income/expense toggle,
  account, category) — every control is a real, working button.
- **Editable transactions grid** (below): every day a row — Date · Day · Type ·
  Category · Description · Income · Expense · Balance — with inline editing,
  +/× per day, and an end-of-day running balance.
- **Accounts, filter, export, MDL.** Wallet & Safe with starting balances; an
  account filter; CSV export (month or all time); Moldovan Leu default.

**How to use it.**
1. Open **Finance**. In **Settings ⚙** set account starting balances, an optional
   monthly budget, and a **savings-goal target** (lights up the goal card + a
   projection).
2. Log money with **Add transaction** / **Quick add**, or type straight into the
   grid below. The whole dashboard updates instantly.
3. Hit **Export** to pull a month (or everything) into Excel.

> **Follow-ups.** Account **transfers** (Wallet → Safe in one step) and
> **recurring** entries (auto-insert rent/allowance each month) are the natural
> next additions.
