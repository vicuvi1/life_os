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
  if you leave the page before explicitly blurring the field, introduced a
  compact number view so large amounts can be displayed as 1k / 1m, and added
  advanced finance workspace enhancements: quick add row, filterable views,
  customizable widget visibility, duplicate transaction alerts, and card/calendar
  transaction views.

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

> **Follow-ups.** **Recurring** entries (auto-insert rent/allowance each month)
> are the natural next addition.

---

## Finance — Phase 1: transfers, honest KPIs & faster entry

**What it is.** A correctness-and-speed pass over the Finance tab: internal
account transfers now work for real, the KPI cards tell the truth, and logging
repeat transactions takes fewer clicks.

**How it works.**
- **Real Wallet↔Safe transfers.** The "Transfer" quick button now opens a
  dedicated dialog (from → to, amount, date, note, with a swap button). A
  transfer is stored as a **linked pair** — an expense out of the source and
  income into the destination — both tagged with the internal `transfer`
  category. Because of the pairing, account balances and net worth move
  correctly, and a transfer nets to zero for the day.
- **Transfers don't distort your stats.** `totalSpent`, `totalEarned`, and the
  category breakdown all **exclude** the `transfer` category, so moving money
  between pots never inflates your income, spending, or savings rate. Transfer
  rows render as a read-only "Transfer" chip (sky) instead of a category picker.
- **Honest KPI cards.** The two cards that both showed net worth are gone —
  the second is now **Net this period** (income − expenses for the current
  range), with a proper *vs last month* delta when you're viewing a month. The
  "Current money" card dropped its misleading vs-last-month figure for a plain
  "Across all accounts" label; it keeps its net-worth sparkline.
- **Faster entry.** Press **Enter** anywhere in the quick-add row to save. The
  quick-add row now **remembers your last-used type, account, and category**
  (persisted locally) so repeat entries start where you left off. Every
  transaction row gains a **Duplicate** button (on hover) to clone a recurring
  cost in one click.
- **Declutter.** Removed the dead "View full report" button from the spending
  panel.

**How to use it.**
1. Tap **Transfer** in Quick add, pick From/To, enter an amount, and save — your
   Wallet and Safe balances update while income/spend stay untouched.
2. In the quick-add row, type an amount and hit **Enter** to log it. The type,
   account, and category stay put for the next one.
3. Hover a transaction row and click the **copy icon** to duplicate it.

---

## Finance — Phase 2: cleaner header & richer Cards / Calendar views

**What it is.** A layout pass that tidies the busy top of the Finance page and
turns the alternate views (Cards, Calendar) from bare read-outs into useful,
interactive surfaces.

**How it works.**
- **Decluttered header.** The old single row of eight controls is split into two
  intentional zones: a **title row** with the primary actions (Add transaction ·
  Export · Settings), and a dedicated **filter bar** underneath holding the time
  range (month stepper + range select), a search box that now grows to fill the
  space, the account filter, and the view switcher. The redundant range badge is
  gone.
- **Compact number-format toggle.** "Full numbers / Compact k/m" is now a small
  segmented control that previews the formats themselves — **`1,234`** vs
  **`1.2k`** — instead of a wide dropdown.
- **Labeled widget toggles.** The show/hide widget row is now prefixed with a
  "Widgets" label so it reads as a control, not stray buttons.
- **Richer Cards view.** Each transaction is a tidy row with its **category icon
  in brand color**, description, date · category · account meta, and a
  **signed, color-coded amount** (green income, red expense, sky transfer).
  Hovering reveals **Duplicate** and **Delete** actions. Empty state included.
- **Better Calendar view.** For a month it keeps the heatmap, then lists **every
  active day in the range** (not just the last six) as compact summary cards —
  each showing the weekday, entry count, a colored net badge, and income/expense
  totals — with today ringed. Empty state included.

**How to use it.**
1. Use the **filter bar** to switch range, search, filter by account, or change
   the view — all in one place.
2. Tap **`1.2k`** in the toolbar to shrink large numbers; tap **`1,234`** to
   show them in full.
3. Switch to **Cards** or **Calendar** in the view menu for a different lens on
   the same transactions; hover a card to duplicate or delete it.

---

## Finance — Phase 3: recurring transactions, category budgets & duplicate cleanup

**What it is.** Three features that cut repetitive data entry and make the budget
tools actionable: money that repeats every month now fills itself in, per-category
caps show live progress, and look-alike transactions can be cleaned up in one place.

**How it works.**
- **Recurring transactions.** A new **Recurring** card in the sidebar (and a
  full **Manage** dialog) lets you define money that repeats monthly — salary,
  rent, subscriptions — each with an amount, account, category, day of month, and
  an **auto-post** switch. Rules are stored embedded on your budget document, so
  no new database setup is required.
  - **Auto-post.** On the first load each month, any *auto-post* rule that has
    reached its day is added automatically. A `lastPostedMonth` stamp guards
    against posting the same rule twice, and posts are batched so their stamps
    save together.
  - **Manual post.** Rules that aren't auto-post (or that you want early) show a
    **Post** button when due, plus a **Post all** action when several are due.
    Posted rules show a ✓ for the month. Everything posts as a normal, editable
    entry — nothing is hidden or locked.
- **Per-category budget progress.** The per-category caps you set in Budget
  settings now render as a **Category budgets** card: each category shows
  this-month spend vs its cap with a progress bar that turns **amber at 80%** and
  **red when over**. (The caps already existed; this surfaces them.)
- **Duplicate cleanup.** The duplicate-detection insight is now actionable — a
  **"N possible duplicates"** button on the Transactions panel opens a review
  dialog that groups look-alike entries (same date, amount, category, and type)
  and lets you delete the extras one by one.

**How to use it.**
1. Open the **Recurring** card → **Manage**, add your salary/rent/subscriptions,
   set each one's day and whether it auto-posts, and **Save**. Auto-post rules
   appear on their day each month; others show a **Post** button.
2. Set per-category limits in **Settings ⚙** to get the **Category budgets**
   progress card.
3. If the Transactions panel shows **possible duplicates**, click it to review
   and delete the extras.

---

## Finance — bulk clear (select rows · clear month)

**What it is.** A fast way to delete many transactions at once instead of removing
them one row at a time.

**How it works.**
- **Row selection.** The transactions table gained a **checkbox column** with a
  **select-all** box in the header. Selected rows are highlighted, and a bar shows
  **"N selected"** with **Clear selected** and **Cancel**.
- **Clear menu.** A **Clear** menu on the Transactions panel offers **Clear
  selected (N)** and — depending on the active range — **Clear all of {Month}**
  (when viewing a month) or **Clear current view** (last-30 / all). The month/view
  option wipes exactly the transactions currently shown (respecting the account
  filter and search).
- **Safe & irreversible-aware.** Every bulk clear routes through a **confirmation
  dialog** that states precisely what will be deleted and how many. Deletes are
  **batched** in Firestore (chunked to stay under the 500-op limit) and applied
  optimistically, so the grid updates instantly.

**How to use it.**
1. Tick the rows you want (or the header box to select the whole view), then hit
   **Clear selected**.
2. Or open the **Clear** menu and choose **Clear all of {Month}** to wipe the
   whole month in one click.
3. Confirm in the dialog — that's the only step that actually deletes.

---

## Finance — full-width transactions table

**What it is.** A layout cleanup. The **Financial Score** sidebar card was removed,
and the **transactions table now spans the full page width** on large screens
instead of being squeezed into the left column. It drops to its own full-width row
beneath the charts and the sidebar, using the space that used to sit empty on the
right — so the grid is roomier and easier to read.

---

## Finance — Subscription Tracker & renewal alerts (Recurring v2)

**What it is.** The primitive Recurring list grew into a proper **subscription
tracker**: it knows *how often* each item repeats, *when it renews next*, *what it
costs you per month and per year*, and it **warns you before a renewal hits** — and
marks renewals right on the calendar.

**How it works.**
- **Frequencies.** Rules are now **weekly / monthly / yearly** (not just monthly).
  The Manage dialog shows the right schedule field for each: a weekday for weekly,
  a day-of-month for monthly, and a month + day for yearly.
- **Next renewal + countdown.** Every rule shows its next renewal date and a
  human countdown — **"in 3 days"**, **"tomorrow"**, **"today"** — turning amber
  when it's within five days so nothing sneaks up on you.
- **Overhead totals.** The card headlines your total recurring **cost per month**
  and **per year** (weekly ×52/12 and yearly ÷12 are normalized in), so you can
  see subscription creep at a glance.
- **Renewal alerts.** Items due now show a **Post now** button (and a **Post all**
  for the batch); anything renewing within three days also surfaces as an
  **insight** at the top of the page.
- **Service icons.** Names/categories are matched to fitting icons — TV for
  streaming, music note for Spotify-likes, cloud for storage/SaaS, home for rent,
  shield for insurance/VPN, dumbbell for the gym, and more — so the list reads at
  a glance.
- **Marks on the calendar.** The month **heatmap** now shows a small **sky dot** on
  every day a subscription renews (with the names in the tooltip), and the
  **Calendar view** lists your next renewals with dates and countdowns.
- **Auto-post, smarter.** Auto-post still fills entries in on schedule, now keyed to
  the exact renewal date and guarded per-period (`lastPosted`) so weekly, monthly,
  and yearly rules each post exactly once per cycle.

**How to use it.**
1. Open **Recurring & subscriptions → Manage**, pick a **frequency**, set when it
   renews, name it (e.g. "Netflix"), and save.
2. Watch the **per-month / per-year** totals and each item's **renewal countdown**;
   amber means it's coming up soon.
3. Switch to the **Calendar** view (or glance at the heatmap dots) to see renewals
   laid out on the month.

---

## Finance — declutter: bigger Spending donut, no Monthly Trend

**What it is.** A readability pass on the dashboard. The **Spending overview** donut
is now noticeably larger — bigger ring, a bigger center total, and a full-size
legend so category names (Food, Fitness, Health…) and amounts read clearly instead
of truncating to single letters. Its panel was widened to give the legend room.
The **Monthly Trend** chart was removed to cut clutter.

---

## Storage & Data — footprint monitor + data-retention manager

**What it is.** A **Settings → Storage & Data** page that keeps Life OS lean and
free to run for years: it measures your data footprint, trims old disposable logs
on a schedule, and lets you export a full copy — all client-side, no server, no
paid plan.

**Honesty first.** This app is client-only Firestore, so a few things in the
original spec can't be done truthfully and are **not faked**: Firestore doesn't
expose exact *billed* storage to the app, there's no overnight cron, and there are
no managed automatic backups. So every number here is a clearly-labelled
**estimate of your own document data** (billed size is higher because of indexes),
cleanup runs **when you open the page** (not via a server), and "backup" means a
one-click **JSON export** you save yourself.

**How it works.**
- **Footprint scan.** Reads all your owner-scoped documents and sums Firestore's
  documented per-document byte sizes, giving a real estimate + a usage bar against
  the ~1 GiB free tier, total document count, and scan latency.
- **By-collection breakdown.** Every collection with its estimated size, share, and
  document count. Protected collections are marked with a lock.
- **Retention policies.** For **log-like** collections only (habit logs, sessions,
  sleep, nutrition, meal-plan, tracker logs, shopping lists, weekly reviews) you set
  "keep N days"; it previews exactly how many records/bytes are older and lets you
  **Run now** or **Apply enabled policies**. Optional **auto-clean on open** runs
  enabled policies (once/day guard) when you visit the page.
- **Protected data is never touched.** Goals, projects, tasks, habits, finance,
  budgets, meals, routines, trackers, wardrobe, and settings can't be auto-deleted
  or selected for cleanup — by construction, not by convention.
- **Manual cleanup.** Delete disposable logs older than a chosen date, with a
  per-collection preview and a confirmation dialog. Irreversible actions always
  confirm first.
- **Trend & projection.** Each visit records a lightweight snapshot (stored on your
  prefs doc, capped at 30); from these you get a real growth trend, a per-month
  growth figure, and a "hit 1 GiB in ~N months" projection.
- **Cost context.** Shows where your estimate sits in the free tier and a rough
  overage figure if you ever exceeded it.
- **Export.** One click downloads all your data as JSON (Firestore Timestamps
  converted to millis) — your portable, real backup.
- **Health.** Honest signals only: connectivity, last-scan latency, document count,
  and a plain note that backups aren't automated (use Export).

**How to use it.**
1. Open **Settings → Storage & data**. It scans automatically and shows your
   footprint and breakdown.
2. Enable the retention policies you want, set the keep-windows, and either **Run
   now** or turn on **Auto-clean on open**.
3. Hit **Export** anytime to save a full JSON backup.

---

## Habits — full tracker overhaul (grid, KPIs, emoji & tags)

**What it is.** The Habits page went from a single check-off list to a proper
**habit tracker**: a habit × date grid you tap to fill in, headline stats, and a
row of analytics — plus custom **emoji**, **tags**, and descriptions on every
habit so you can add and organize as many as you like.

**How it works.**
- **KPI row.** Total habits · completion rate (this 4-week period) · current
  streak (with your best) · total completions · success trend vs the previous 4
  weeks.
- **Tracker grid.** Rows are habits, columns are days (a scrollable 4-week window
  with ◀▶ navigation). Each cell shows its status — **completed** (habit color +
  check), **partial** (logged below target), **missed** (a past daily-habit day
  with no log), or **not done** — and you **tap any cell to toggle** that day.
  Today is highlighted. Each row has a **completion-% bar** and a ⋯ menu to
  **edit or delete**.
- **Statuses are derived, not nagged.** Partial comes from count/duration habits
  logged under target; a day only counts as "missed" if it's a past day for a
  daily habit created by then — weekly habits and pre-creation days never show as
  missed, so the numbers stay fair.
- **Show numbers.** A toggle swaps the dots for the logged value on count/duration
  habits (e.g. glasses of water, minutes).
- **Filter & search.** Filter by category and search by name or tag.
- **Analytics.** Weekly-completion bars (Mon–Sun), your top **best streaks**, a
  **completion heatmap** for the window, and a **summary** counting completed /
  partial / missed / not-done.
- **Custom emoji & tags.** The add/edit form now has an **emoji field** (type one
  or pick a preset) and a **tags** input (type, Enter/comma to add, backspace to
  remove) alongside the existing description, color, category, frequency, and
  target type.

**How to use it.**
1. **Add habit** → give it a name, an emoji, some tags, and how it's measured.
2. Tap cells in the grid to mark each day done; use ◀▶ to review earlier weeks.
3. Watch the KPI row, streaks, heatmap, and summary update as you check in.

---

## Habits — instant toggle, inline add, 365-day heatmap & per-habit stats

**What it is.** A polish + power pass on the tracker: check-ins are now instant
(no reload/flicker), you can add a habit right where the grid is, there's a
GitHub-style full-width year heatmap, per-habit statistics, and a streak nudge.

**How it works.**
- **Instant, flicker-free toggling.** Tapping a cell updates the grid immediately
  and writes to Firestore in the background (idempotent per-day doc id). Streaks
  and KPIs are now derived **live from your logs**, so nothing refetches or
  "blips" after a tap.
- **Inline add.** A quick-add row sits right under the grid — type a name, press
  **Enter**, and the habit appears (with **More options** for emoji/tags/target).
  The header **Add habit** button stays for the full form.
- **365-day heatmap.** A full-width, GitHub-style year grid (53 weeks × 7 days)
  shows a whole year of consistency at a glance, colored by daily completion, with
  a less→more legend. It replaces the old small month heatmap.
- **Per-habit statistics.** The ⋯ menu → **Statistics** opens a dialog with current
  & longest & average streak, success %, missed %, total completions, and
  completion **by weekday** and **by month**.
- **Motivation.** When you're on a roll, a 🔥 banner calls out your longest active
  streak so you don't break it.

**How to use it.** Tap across the grid (instant); add habits from the row under the
grid; open a habit's ⋯ → **Statistics** for its breakdown; scan the 365-day
heatmap for your year at a glance.

---

## Habits — templates, difficulty, archive, per-day notes (+ correctness fixes)

**What it is.** A quick-wins bundle plus fixes surfaced by an adversarial review.

**New features.**
- **Templates.** A **Templates** button opens ready-made packs (Morning, Gym,
  Study, Productivity, Health, Night) — pick individual habits or whole packs and
  add several at once, then tweak.
- **Difficulty.** Each habit has an Easy / Medium / Hard / Expert level (a colored
  dot on its row), and completions earn **difficulty-weighted points** shown in
  its Statistics.
- **Archive.** ⋯ → **Archive** hides a habit from the tracker while keeping its
  full history; a **Show archived (n)** toggle brings them back. Nothing is
  deleted.
- **Per-day notes.** **Right-click any cell** (or ⋯ → **Note for today**) to jot
  down how a day went ("felt tired", "80kg bench"). Days with a note show a small
  blue dot, and recent notes appear in the habit's Statistics — so you can see
  *why* a streak broke.

**Correctness fixes (from the review).**
- **Weekly habits build streaks properly** now — streaks are counted in weeks for
  weekly habits instead of requiring impossible consecutive days.
- **"X/Y done today"** uses real completion (a below-target log is no longer
  counted as done), matching the grid.
- **Midnight-safe window.** The date window is derived from the live date, so
  today's column never disappears if the tab is left open past midnight.
- **Honest success trend.** Brand-new habits with no prior 4 weeks show **"New"**
  instead of an inflated "+X%" against an empty baseline.

---

## Habits — view modes (Table · Cards · Compact · Calendar)

**What it is.** A view switcher in the filter bar lets you see the same habits four ways:
- **Table** — the full habit × date grid (default).
- **Cards** — one card per habit with its completion %, streak, tags, and a big
  **Mark today / Done today** button.
- **Compact** — a dense list: each habit with a 14-day dot strip, streak, and %,
  for a fast scan.
- **Calendar** — a month grid where each day is shaded by how many habits you
  completed that day (with the completed/total count), for a monthly overview.

All views share the quick-add row and the ⋯ menu (Statistics · Note · Edit ·
Archive · Delete); tap cells to toggle and right-click for a note in Table and
Compact.

**Fix — the check-in "blink."** Tapping a cell flashed the whole grid to the
loading skeleton and back. Root cause: the streak-recompute (and habit-delete)
queried habit logs by `habitId` only, which Firestore's owner-scoped rules
**reject**, so the toggle threw and the error path did a full (skeleton) reload.
Those queries are now scoped by `userId` (filtered to the habit client-side), and
the toggle's fallback reconciles **silently** — so check-ins are instant with no
flash.

---

## Habits — delight: animations, milestones, more templates & emoji

**What it is.** Check-ins now feel good, and progress gets celebrated.
- **Check-in animation.** Completing a cell gives it a springy **pop** (respects
  reduced-motion).
- **Streak milestones.** Hitting **3 / 7 / 14 / 21 / 30 / 50 / 75 / 100 / 150 /
  200 / 300 / 365** days pops a celebration message — e.g. *"100 days!! Legend —
  keep it up, boss 👑"* — that auto-dismisses.
- **More templates.** Added **Mindfulness, Break bad habits, Money, Language, and
  Creativity** packs (on top of Morning / Gym / Study / Productivity / Health /
  Night).
- **Bigger emoji picker.** The habit form's emoji presets went from ~18 to ~70,
  in a compact scrollable grid (you can still type or paste any emoji).

---

## Habits — full flexibility (edit any day · custom categories/colors · reorder · settings)

**What it is.** Make everything about habits editable and configurable.
- **Edit any day.** Right-click (or long-press) any cell — past or present — to open
  a day editor: mark done/not-done, set an **exact value** for count/duration
  habits (e.g. 6 of 8 glasses), and add a **note**. ⋯ → **Edit today** opens the
  same editor for today. (Left-click still instant-toggles.)
- **Custom categories.** The category field is now free text with suggestions —
  type your own (Finance, Family, Faith…) beyond the built-ins. The filter lists
  every category you actually use.
- **Any color.** Alongside the 8 presets, a **color picker** lets you choose any
  color for a habit.
- **Reorder.** ⋯ → **Move up / Move down** arranges habits in exactly the order you
  want (saved per habit).
- **Flexible tracker settings.** Choose the grid **range** (2 / 4 / 8 / 12 weeks),
  the **week start** (Mon or Sun — applies to the weekly bars, heatmaps, and
  calendar), plus your **view** and **show-numbers** preference — all remembered
  on your device.

**Inline emoji & color.** Click a habit's **icon dot** in any view (Table, Cards,
Compact) to open a quick editor and change its **emoji** and **color** right
there — changes apply instantly, no need to open the full Edit form. (The full
form still has both too.)

---

## Habits — "Today" hero summary + table polish

**What it is.** The five plain KPI cards are replaced by one actionable hero, and
the tracker table got a batch of polish.
- **Today hero.** One card shows **X / Y habits complete** with a big progress bar
  and %, **estimated time left** today (from your incomplete habits' durations),
  and your **longest current streak** — plus a **Remaining today** checklist you
  can tick straight from the summary.
- **Today column highlighted.** Today's whole column (header + cells) gets a subtle
  purple tint so it's easy to find.
- **Visible progress bars.** Each habit row shows a real progress bar (not just a
  %), always on.
- **Rich hover.** Hovering a cell shows the date, status, logged value, the time it
  was logged, and any note.
- **More right-click / menu actions.** The ⋯ menu now also has **Emoji & color**,
  **Duplicate**, plus the existing Statistics / Edit day / Edit habit / Move
  up-down / Archive / Delete.
- **Taller, sticky table.** The grid scrolls with a **sticky header and habit
  column**, so many habits stay readable.

> Still on the wishlist for a focused follow-up: **row-expand** (click a habit to
> reveal history/graph/notes inline) and **collapsible category groups**.

---

## Wardrobe & Outfits — foundation (items · today's outfit · laundry)

**What it is.** The start of a full wardrobe system: a photo catalog of your
clothes, a "Today's outfit" flow with weather, and a proper laundry cycle — under
a new **Wardrobe** section in the sidebar (Wardrobe · Laundry).

**How it works.**
- **Rich clothing items.** Each item holds up to **4 photos** (first = thumbnail;
  photos are compressed hard client-side and stored inline — no paid storage
  plan needed), plus category, brand, color, size, **season & style tags** (all
  user-extensible, never locked lists), purchase date, **price** (in your app
  currency), notes, care instructions, and a favorite ❤️.
- **Today's Outfit hero.** Pick today's items from a filterable picker
  (wearable-only by default). **Wear today** logs the date and bumps
  `times worn` / `last worn` on every item (and marks them Worn); you can also
  **save the combination as an outfit** (one-off or reusable template) in the
  same step, or **plan a future day** instead. A compact **weather block**
  (Chișinău) shows current conditions, with a "perfect weather for this outfit"
  note only when the outfit's manually-set weather range matches.
- **Wardrobe grid.** Search (name/brand/tag/color), category quick-tabs (from
  the categories you actually use), status filter, favorites and retired states.
- **Laundry flow.** Clean → Worn → Dirty → Washing → Drying → Ready, plus an
  independent **needs-ironing** flag. Status changes are one click from any card;
  the Laundry page is a set of **filtered tabs over the same items** (never
  separate lists) with **bulk actions** — select many, mark them Washing/Ready/…
  together.
- **Item detail page.** Photo gallery with thumbnails, all metadata, live
  **cost-per-wear** (price ÷ times worn), tabs for Outfits it appears in / wear
  History / Notes / Care, and **Retire** — which hides an item from active views
  and pickers while keeping its full history and stats.
- **Sidebar extras.** Clothing-status counts (each linking to a pre-filtered
  laundry view), compact stats (most/least worn), and the next 3 days'
  **planned outfits**.
- **Storage note.** Outfits and daily wear-logs live in the existing `clothing`
  Firestore collection (docType-discriminated) so the already-deployed security
  rules cover everything — no config changes needed.

**Next increments.** Outfits & Templates pages, Statistics (incl. wardrobe
cost-per-wear ranking + gap analysis), the full Outfit Calendar, "Surprise me"
randomizer, packing lists, and seasonal storage filters.

---

## Wardrobe — Outfits & Templates

**What it is.** The second wardrobe increment: build, manage, rate, and wear
saved outfits — with templates as reusable go-tos.

**How it works.**
- **Outfits page** (sidebar → Outfits): every saved outfit as a card with its
  item photo strip, Template/Custom badge, occasion tags, ★ rating, favorite ❤️,
  and worn count / last-worn. Filter tabs (**All / Templates / Favorites**), an
  occasion filter row, and search.
- **Outfit builder.** Pick items from a filterable grid (search + category
  chips, retired items excluded), name it, tag **occasions** (user-extensible:
  University, Gym, Rainy Day…), optionally set a manual **weather fit** range
  ("18-28°C, sunny") and notes, and save as a **Template** or one-off Custom.
- **Outfit detail.** Item photos linking to their detail pages, stats (worn,
  last worn, weather fit), a **click-to-set star rating**, notes, and full
  actions: **Wear today · Edit · Duplicate · Share · Delete** (share uses the
  system share sheet or copies a text summary).
- **Wear today from an outfit** logs the day and bumps counters on the outfit
  *and* every item (marking them Worn).
- **Quick Templates row** on the Overview: shortcut chips for Templates,
  Favorites, and every occasion in use (with counts) that filter straight into
  the Outfits page. The row reflects the tags you actually use, so adding or
  renaming happens naturally through your outfits.
- **Start from an outfit** in the day picker: picking today's clothes now offers
  your saved outfits as one-tap starting points; tweaking the selection turns it
  back into an ad-hoc combination.

---

## Wardrobe — Statistics & Outfit Calendar

**What it is.** The third wardrobe increment: an honest statistics page that
tells you what you actually wear, and a month calendar for planning future
outfits and logging past ones.

**Why it exists.** Photos and outfits are only worth the effort if they pay you
back in insight and less daily decision-making. Stats surface your best-value
clothes and dead weight; the calendar turns "what do I wear tomorrow" into a
30-second plan and keeps an effortless history of what you wore.

**How it works.**
- **Statistics page** (sidebar → Wardrobe → Statistics):
  - **KPI row** — item count, total **wardrobe value** (sum of item prices in
    your currency), total wears, and **worn this month** with a trend arrow
    (shown only once there's a previous month to compare against — never a fake
    trend from a single data point).
  - **Most worn** and **Best value** (lowest **cost-per-wear**) rankings, plus
    **Costly & underused** (highest cost-per-wear) and **Never worn** — the last
    two flagged so you know what to wear more or let go. Cost-per-wear only
    appears for items that have both a price *and* at least one wear.
  - **By category** breakdown bars and an honest **wardrobe gaps** panel: default
    categories with zero items, and occasions with no saved outfit (each links
    straight to building one).
- **Outfit Calendar** (sidebar → Wardrobe → Outfit Calendar): a Monday-first
  month grid. Each day shows its logged outfit's item thumbnails and a **Worn**
  (green) or **Planned** (blue) marker; today is highlighted; a month summary
  counts worn vs planned days. Tap any day to open the picker:
  - **Today** → confirm what you're wearing (counts + Worn status).
  - **A future day** → plan it (nothing is marked worn until it happens).
  - **A past day** → **log what you wore** (wear counts update; current laundry
    status is left untouched, and `last worn` only advances — never rewinds).
  - **Clear day** removes a day's entry and rolls its wear counts back.
- **One reconciling write path.** All wear writes now go through a single
  function that **diffs the new selection against whatever was already logged for
  that day**, so re-confirming or editing a day never double-counts `times worn`,
  and clearing a confirmed day correctly decrements it.

---

## Wardrobe — Surprise Me, Packing Lists & Seasonal filter

**What it is.** The final wardrobe increment — the everyday-convenience extras
that finish the system: a one-tap outfit randomizer, trip packing lists, and a
seasonal filter over your wardrobe.

**How it works.**
- **Surprise me** (button on the Overview + in the empty "today" hero): builds a
  random wearable outfit — one item per core category (Tops / Bottoms / Footwear
  / Outerwear) drawn only from **clean/ready/worn** items (never something in the
  wash). **Shuffle** re-rolls; an optional **season** filter constrains it (Any /
  In season / a specific season); **Wear it today** logs it through the same
  reconciling write path as everything else. If nothing is wearable it says so
  honestly instead of inventing an outfit.
- **Packing lists** (sidebar → Wardrobe → Packing): plan a trip by name (and
  optional day count), pick the clothes to bring from your wardrobe, then **tick
  each item off as you pack**, grouped by category with a progress bar. Multiple
  trips, edit/reset/delete, and items that later leave your wardrobe are dropped
  gracefully. Stored in the existing `clothing` collection (docType "packing") —
  no new security rules.
- **Seasonal filter**: the wardrobe grid gains a season selector — **All seasons**,
  **In season** (auto-detected from the month), or a specific season. Items with
  no season tag count as all-season and always show, so nothing hides
  unexpectedly.

**Also in this release — data-integrity & UX hardening** (from an adversarial
review of the whole wardrobe area):
- **Atomic wear counters.** `times worn` now uses Firestore's `increment()`
  sentinel everywhere, so concurrent writers can't clobber each other, and the
  edit form no longer rewrites the counter on save.
- **Legacy Routines widget** no longer shows retired items and its quick "wear"
  now marks the item worn + updates `last worn` (consistent with laundry and
  recently-worn), via a shared atomic helper.
- **Retired items are reachable again** — a "Retired" filter on the wardrobe grid
  surfaces them (and their Unretire button).
- **The day picker validates its selection** — deleted/retired ids can no longer
  ride along into a confirmed wear or produce an empty logged day; the button
  count reflects only real items.
- **Planning is reachable from the Overview** too: the "Upcoming outfits" rows
  are now tappable (plan any of the next days), matching the Calendar.
- Smaller fixes: honest weather-match (only real temperature ranges, e.g.
  "18-28°C", trigger the badge), the Favorites shortcut now lands filtered, a
  stale `?occasion=` deep link self-clears, the outfit "Wear today" action is
  disabled (not silently ignored) when an outfit has no wearable items, and the
  item photo viewer no longer blanks after you delete a photo.

**UI polish pass.**
- **Unified sub-navigation.** Every wardrobe page (Wardrobe · Outfits · Calendar
  · Packing · Laundry · Statistics) now shares one horizontal tab strip that
  highlights the current page, replacing the ad-hoc back-links and the crowded
  row of header buttons on the Overview. Navigation is consistent and one tap
  from anywhere; each page keeps only its own primary action (Add item, New
  outfit, New trip…).
- **Resilient saves.** Every wear write (confirm, plan, log, surprise, outfit
  "wear today", clear day) now recovers from a mid-air failure — if something it
  referenced was deleted on another device, the app resyncs instead of silently
  losing the change, and the pickers show a clear inline message rather than
  failing quietly.

---

## Wardrobe — Overview redesign

**What it is.** A visual overhaul of the wardrobe home so it works like a real
outfit dashboard, not a list.

**What changed.**
- **Bigger "Today's Outfit" hero.** Before an outfit is picked it shows four
  labelled placeholder slots (Top · Bottom · Shoes · Accessory) with **Pick
  today's outfit** and **Surprise me**; once picked, larger item tiles with
  status dots and quick actions.
- **Smarter weather.** The weather panel now gives an at-a-glance **what to wear
  today** — e.g. ✓ T-shirt ✓ Shorts ✗ Hoodie — derived from the current
  temperature, alongside the conditions and location.
- **Richer clothing cards.** Each card now shows brand · category, a
  season • style line, a prominent **usage counter** ("42× worn" / "never worn")
  and **last-worn** ("3 days ago") as photo overlays, plus the favorite and
  needs-ironing markers — and the grid is **denser** (up to 6 across) so you see
  far more at once.
- **Quick filters.** One-tap **Favorites** and **Recently worn** chips next to
  the type chips, plus a **colour palette** row (tap a swatch to filter by
  colour). Search now spans name, brand, colour, style, season and tags.
- **Wardrobe-health sidebar.** The status card is now titled Wardrobe health
  with a total-items badge and a **Never worn** count; every status row still
  links straight to its filtered laundry view.
- **Richer statistics.** Most-worn and least-worn now show their wear counts,
  plus **Never worn** count and **Favorite brand** (the label you own most).
- **Visual upcoming outfits.** The next few days show a weekday label (Tomorrow,
  Wednesday…), the planned outfit's name, and item thumbnails — tap any day to
  plan it.
- **Smarter Surprise Me.** The randomizer now de-prioritises pieces worn in the
  last few days and leans toward favorites, so re-rolling feels fresh.

**Deferred (larger, follow-up work):** a slide-over quick-view panel on item
click (instead of a full page), a drag-and-drop outfit builder, and a
"worn once / worn twice" wear-since-wash sub-status.

---

## Wardrobe — Quick-view panel, drag-and-drop builder & freshness

**What it is.** The three follow-ups from the Overview redesign, now shipped.

- **Slide-over quick view.** Tapping a clothing card on the Overview opens a
  right-hand **panel** instead of navigating away — photo (with extra shots),
  one-tap status control, favorite/retire, key facts (times worn, last worn,
  colour, size, season, style, price, **cost-per-wear**), the outfits it appears
  in, and notes/care. **Edit** opens the form inline; **Full details** still
  links to the dedicated page. Much faster to skim your wardrobe.
- **Drag-and-drop outfit builder.** The builder now has a dashed **"Your outfit"**
  drop zone: drag clothes in from the picker, **drag to reorder**, and remove
  with the ×. Tapping still works everywhere (so it's fine on touch), and the
  order you arrange is the order the outfit saves in.
- **Freshness ("worn once / twice").** Every item tracks **wears since its last
  wash**. A worn item now shows a colour-coded badge — 🟡 Worn once, 🟠 Worn
  twice, 🔴 Worn 3×+ — on its card and in the quick view, and once it passes the
  threshold the app **nudges you to wash it** (with a one-tap "Mark dirty"). The
  counter resets automatically whenever you move the item to washing / clean /
  ready, so it always reflects reality.

---

## Wardrobe — Overview refinements

A cleanup pass from a design review of the Overview:
- **One navigation.** Removed the top tab bar; the **left sidebar** is the single
  source of navigation (Packing was added there so every wardrobe page is
  listed). No more duplicate nav for the same pages.
- **One "Surprise me".** Consolidated the three surprise entry points into a
  single in-context flow (below).
- **Today's suggestion is now real.** Instead of empty silhouettes beside a
  disconnected weather checklist, when no outfit is picked the hero shows an
  actual **suggested outfit** — real items chosen for today's weather (warm →
  summer pieces, cold → winter), avoiding what you wore in the last few days and
  leaning on favorites — with **Wear this**, **Shuffle**, and **Pick manually**.
  (If nothing's clean, it falls back to the placeholder slots with a note.)
- **Wardrobe health** now hides zero-count status rows, so you see only what's
  actually there instead of five "0" lines.
- **Favorite brand** only appears once you own 2+ pieces of a brand (no more
  single placeholder entry).
- Fixed the clipped search placeholder.

---

## Wardrobe — Weather planning & richer analytics

Deltas from the "advanced wardrobe" spec (most of which the system already met —
full item/outfit CRUD, image capture, drag-and-drop builder, laundry, wear
counts, cost-per-wear, today's suggestion, quick-view; this pass closes the
remaining gaps):
- **Outfit seasons.** Outfits can now be tagged with **seasons** (in the builder,
  shown on the detail view) in addition to occasions and weather-fit.
- **Outfits for today's weather.** The Overview now shows up to **three saved
  outfits that suit today's weather** (matched by season or a weather-fit range),
  each with one-tap **Wear today**.
- **7-day planner with forecast.** The upcoming panel now spans **7 days**, each
  showing that day's **weather forecast** (icon + high) pulled from Open-Meteo —
  tap any day to plan it.
- **Richer analytics.** Statistics now reports **total invested**, **average cost
  per item**, **average cost-per-wear**, and a plain-language **recommendation**
  (e.g. "3 items have never been worn — style them or let them go", or your
  priciest-per-wear piece) so the numbers turn into a next action.

Everything remains fully editable from the UI — items, outfits, seasons,
occasions, statuses, prices and plans are all data in Firestore, no code needed.

---

## 🌙 Sleep — Foundation (Milestone 1)

**What it is.** A real daily sleep tracker: a dashboard, richer logging (times +
naps), a week chart, a month calendar, goals, and searchable history.

**Dashboard.**
- **Sleep score** (0-100 ring) for last night, blending duration-vs-goal (50%),
  quality (30%) and efficiency — time asleep ÷ time in bed (20%).
- **Duration, bedtime, wake-up, time in bed, quality**, a **goal-progress** bar,
  and your **current streak** (consecutive nights meeting the goal).
- KPI tiles: 7-day average duration, 7-day average score, current streak, and an
  inline-editable nightly goal.

**Logging.**
- **Log sleep / Edit sleep / Add nap** quick actions. Enter **bedtime + wake-up**
  and the duration is computed automatically (wrapping past midnight), or just
  type a duration (handy for naps). Optional **awake-during-the-night** minutes
  refine sleep-vs-time-in-bed. Quality slider (1-10) and notes.
- **Naps** are tracked as separate sessions, so a day can have a main sleep plus
  several naps — "multiple sleep sessions" without disturbing the nightly record.

**Calendar & history.**
- **This week** bar chart — one bar per night, height = duration, colour = score,
  tap to open that day.
- **Month calendar** — every night colour-coded by score with its duration; a ☀️
  marks days with naps; tap any day to log or edit it.
- **History** list of every night and nap with a **date search**, each row
  editable.

**Goals.** Set **target duration**, **target bedtime**, and **target wake-up** —
all editable inline and stored per-user.

**Under the hood.** The main night sleep stays one-per-day (deterministic id, so
the dashboard/insights/calendar keep working unchanged); naps are extra docs in
the same `sleepLogs` collection and are excluded from the legacy night-only
queries. Sleep scores/streaks are computed client-side — no schema migration
needed, and older logs (hours + quality only) still render correctly.

---

## 🌙 Sleep — Analytics, Insights, Routine & Recovery (Milestones 2 & 3)

A full dashboard rebuild toward a proper sleep app, with a date navigator that
focuses the top cards on any day.

**Top cards.** Sleep Score ring · Sleep Duration (time-in-bed, ± vs goal, a 7-day
mini-bar, bedtime→wake) · **Recovery** ring (sleep score adjusted for recent
sleep debt) · **Energy today** % (predicted from recovery + goal streak). Plus a
one-line **daily recommendation** driven by your data.

**Analytics (Milestone 2).**
- **365-day heatmap** of nightly duration (tap a day to log/edit it).
- **Current streaks**: sleep-goal, bedtime, wake-up, and consistency.
- **Sleep summary**: average sleep, **average bedtime / wake-up** (circular means,
  so times that wrap midnight average correctly), **sleep consistency %**, and
  best / worst nights with dates.
- **Trends (this week)**: sleep-duration line vs the goal, and a **bedtime &
  wake-up** dual-line chart.
- **Monthly goal**: % of tracked nights on goal + a per-day dot grid.
- **Sleep debt / surplus** feeds recovery and the recommendation.

**Routine & Recovery (Milestone 3).**
- **Evening & morning routines** — fully customisable checklists (add / rename /
  remove / time each step; sensible defaults to start). Per-day completion is
  tracked (tap to check off).
- **Morning check-in** — one-tap mood/energy for the day.
- **Recovery score, energy prediction, and daily recommendation** as above.
- **Recent sleep sessions** table (duration, time in bed, score, quality, notes).

**Storage.** Routine definitions live on the prefs doc; per-day routine
completion + check-in live in a `docType: "meta"` doc in `sleepLogs`
(`${userId}_meta_${date}`), excluded from sleep/nap queries — so nothing needed
new security rules.

**Deferred — reminders.** Bedtime / wake / goal *targets* are set here, but true
push **reminders/notifications** need a backend (FCM / service-worker scheduling)
that this client-only setup can't provide honestly, so they're intentionally not
faked. The targets drive the streaks and recommendations in the meantime.

---

## 📲 Telegram notifications

**What it is.** Connect a personal Telegram bot and get Life OS notifications on
your phone — no app-store install, no backend.

**How it works.**
- **Settings → Telegram notifications**: create a bot with **@BotFather**, paste
  the token (stored only in your own private prefs), tap **Check** to verify it,
  message your bot once and tap **Detect** to auto-find your chat, then **Send
  test**. Toggles enable notifications and "send a summary when I log sleep".
- The Telegram Bot API is CORS-enabled, so messages are sent **directly from the
  browser** — nothing server-side to run or pay for.
- **Sleep integration**: logging a night pushes a summary (duration, quality, ±
  vs goal); the dashboard's recommendation card has a **Send to Telegram** button
  for last night's score/recovery/energy/tip on demand.

**Honest limitation.** These fire when the app sends them (logging, test, or the
Send buttons). Truly *scheduled* reminders while the app is closed still need a
small server component (a Vercel cron + Firebase Admin, Hobby-plan-friendly at
once-a-day) — a clean next step, not faked today.

---

## 🧠 Agent Hub — dashboard, AI agents & automations

**What it is.** The central nervous system of Life OS: one surface that reads
across every module. Three parts — a **dashboard** (one glance = the state of
your day), **AI agents** (chats pre-loaded with your real data), and an
**automations engine** (rules that watch your data and notify you).

**Dashboard (`/hub`).**
- **Needs Attention** — auto-generated from every enabled automation whose
  condition is *currently true*; each row links into its module.
- Today's weather (+ rain-tomorrow flag), **today's outfit** (picked or a live
  suggestion reusing the wardrobe logic), **recent automations** log, agent
  tiles, and an inbox link with unread count.

**Agents (`/hub/agents`).**
- Four built-in agents work immediately — Wardrobe 🧥, Finance 💰, Sleep 🌙,
  Tasks ✅ — plus **Create custom agent** (name, icon, module, provider, model,
  editable system prompt; `{{context}}` marks where live data is injected).
- **Context injection:** every message first assembles a compact live summary
  from Firestore (e.g. wardrobe: wearable items + statuses + today's outfit +
  weather; finance: month spend by category vs budget; sleep: last night, debt,
  streak; tasks: open/overdue) and renders it into the system prompt — agents
  answer from *your* data, never canned assumptions.
- Chat history persists per agent; clear-chat and delete-agent supported.
- **Multi-provider:** every call goes through one `callAgentModel()` abstraction
  — Anthropic (Claude) and Google Gemini today; adding a provider later is one
  new branch. Each agent picks its provider/model independently.
- **Settings → AI providers:** paste your own Anthropic and/or Gemini key
  (stored in your private prefs, sent browser→provider directly, shown as a
  password field). *Honesty note:* this app is a normal website, not a
  claude.ai artifact, so Anthropic is **not** pre-authenticated — both providers
  need a key; Gemini's free tier makes it a good default.

**Automations (`/hub/automations`).**
- Rule = **metric → operator → value → action**, all dropdowns. Metrics span
  modules: dirty items, wash-cycle count, ironing, no-outfit-today, budget %,
  sleep debt, last night's hours, sleep-not-logged, overdue/due-today tasks,
  rain tomorrow.
- Actions: **notify** (inbox + optional Telegram) or **Needs-Attention only**.
  Notify rules fire at most once per day; every fire updates `lastFired`.
- **Starter pack** (one tap): laundry ≥5, budget ≥85%, sleep debt ≥3h, rain
  tomorrow, overdue tasks.
- *Honest scope:* rules evaluate when the app is open (hub/automations pages) —
  client-side apps can't watch data while closed; Telegram delivers the result
  to your phone.

**Notifications (`/hub/notifications`).** Unified inbox: unread highlighting,
mark read/unread, mark-all, clear-all, tap-through to the module.

**Storage.** All hub docs (agents, automations, notifications, conversations)
live in the existing `decisions` collection discriminated by `docType` — that
collection is only ever read by direct doc id, so hub docs are invisible to
existing code and no new security rules were needed. Provider keys live on the
prefs doc alongside the Telegram token.

---

## 🌙 Sleep — dashboard polish (from design review)

- **Adaptive hero.** With no data logged it's one inviting card ("Good
  morning 🌙 · Log last night"); once a night is logged it transforms into a
  unified strip — **Sleep score · Duration (+ vs-goal + 7-day mini-bars +
  bedtime→wake) · Recovery · Today's energy** — instead of four half-empty cards.
- **Today's recommendation** is now a short, prioritised **list** of concrete
  tips (skip hard training, hydrate, earlier bedtime…) with a one-tap Telegram send.
- **Calendar** gains a **Month ⇄ Year** toggle, and tapping any day opens a
  **side panel** with that night's score, duration, times, recovery, quality,
  naps and morning check-in.
- **Sleep trend** shows **Avg / Goal / Diff** above the line and rings the
  **best (green) and worst (red)** night; the **bedtime chart shades the ideal
  window** around your target bedtime.
- **Streaks** add **🏆 Longest** and a progress ring (current vs longest).
- **Sleep summary** now reports the daily-useful set: **average score, average
  duration, consistency, average recovery, and sleep debt** — with a dedicated
  **sleep-debt bar**.
- **Monthly goal** is a real **mini-calendar** (✓ hit / ✕ missed / number) you
  can tap into the day panel.
- **Morning check-in** is richer: **mood · energy · stress · recovered · notes**
  (stored for later correlations).
- **Routines** get a **progress bar**, a **"by HH:MM" finish time**, and
  **Mark-all / Reset** quick actions.
- **Life Agent card** ties Sleep into the Agent Hub — last night's summary plus
  computed **best focus window, workout readiness, and suggested bedtime**, with
  a link into the Sleep Agent chat.

**Deferred (needs a device/integration, not faked):** a deep-sleep/REM
**timeline** and **Apple Health / smartwatch import** require a wearable; a
full **sleep↔habits/mood/productivity correlations** view is a larger analytics
pass — all flagged in-app rather than mocked.

---

## 🔔 Notification builder (Telegram)

**Settings → Notification builder.** Replaces the fixed on/off summary toggle
with a full editor: every notification type is customisable in wording, timing,
and buttons.

**Phase 1 (shipped).**
- **Five event types** to start — Bedtime reminder, Morning summary, Sleep
  logged, Weekly review, Habit nudge — each with **Preview / Template /
  Conditions** tabs. New event types can be added without a schema change.
- **Variables.** A grouped, click-to-insert picker (Sleep, Habits, Calendar,
  Weather, Time, General) drops `{{tokens}}` at the cursor; a resolver
  substitutes them from **live data the app already tracks**, with a sensible
  **fallback** when a value is missing (never a raw `{{next_event}}` leak).
- **Style presets** (Friendly / Minimal / Coach / Motivational / Funny) as
  one-click starting text you can then freely edit.
- **Conditions.** Relative to a reference time (`N min before/after target
  bedtime/wake`), absolute time, day-of-week scope, and simple state gates
  ("only if sleep isn't logged today", "only if habits remain") — no scripting.
- **Live preview** in a Telegram-style bubble using realistic sample data, plus
  **Send now** which resolves with your real data and delivers via Telegram.
- **Editable buttons** — labels are free text; actions stay in a safe set
  (open app, start routine, log sleep, snooze, dismiss).
- **Delivery history** — reverse-chronological log (event, resolved text,
  delivered/failed, timestamp) filterable by event type.
- **Live wiring:** the **Sleep logged** template now drives the real auto-send
  when you log a night (and writes to history) — it's the one event a
  client-only app can fire on its own.

**Phase 3 bits (shipped now, cheap + reuse existing infra).**
- **✨ AI rewrite** — rewrite any template in a chosen tone (Professional,
  Friendly, Funny, Minimal, Formal, Military, Stoic, Gen Z), **preserving every
  `{{variable}}`**, shown as a preview you accept or discard. Routes through the
  existing **Settings → AI providers** keys — no second credential flow.
- **Export / Import** a template as JSON (share with a friend on Life OS).

**Phase 2 (shipped).**
- **If / Else conditional text** — a simple form (variable · operator · value ·
  then-text · else-text) inserts a `{{#if var op value}}…{{else}}…{{/if}}` token
  the resolver evaluates at send time. Operators kept simple (`<`, `>`, `=`,
  `is set`, `is not set`) — not a scripting language.
- **Drag-and-drop block builder** — a Text ⇄ Blocks toggle switches the same
  template between raw text and a reorderable stack of blocks (Text, Sleep score,
  Streak, Recommendation, Goal progress, Progress bar, Weather, Calendar event,
  If/Else). Blocks **compile down to the same `body` string**, so send/preview/
  history all stay on one path and the **one live preview** renders either mode.

**Background sender (shipped).** Hands-free scheduled delivery now exists via a
secured serverless endpoint `/api/notifications/run` (Firebase Admin + Telegram):
- It reads each user with Telegram enabled, evaluates their **enabled,
  time-based** templates against the **current local time** (Europe/Chișinău by
  default, `?tz=` to override), resolves variables from live data, sends via
  Telegram, writes a history entry, and **dedupes once per day** per template
  (`lastFired`).
- Driven by a **Vercel Cron** (`vercel.json`, hourly — Hobby throttles to ~daily,
  lower the schedule for finer timing) or any external scheduler hitting the URL
  with `?key=<CRON_SECRET>`.
- **Self-disabling:** with no `CRON_SECRET` / `FIREBASE_SERVICE_ACCOUNT` env it
  no-ops, so it never affects the app until you configure it (see `.env.example`).
  The `sleep_logged_summary` template still fires instantly client-side on log.

**Editor UX pass (shipped).**
- **Always-on live preview** — the Telegram-style bubble sits beside the editor
  and updates as you type (no more editing blind); Send-now lives there too.
- **Test scenarios** — a dropdown swaps the preview data (Sample · Good sleep ·
  Average · Poor · No sleep · Weekend · Vacation) so you can see exactly how
  conditionals and variables render in each case.
- **Variable inspector** — tapping a variable inserts it *and* shows its
  description, an example value, and which templates use it.
- **Today's notifications timeline** — a strip of when each enabled time-based
  notification will fire (from its condition + your targets).
- **More blocks** — added Recovery, Quote, and Divider to the block builder.
- **History actions** — every logged send can be **resent** or jumped to its
  template to **edit**.
- **Real buttons** — messages now carry actual Telegram inline **URL buttons**
  (Open app / routine / sleep). Callback actions (snooze/dismiss) still show in
  the preview but need a bot webhook to be tappable — left out honestly.

**Deferred.**
- **AI Summary block** — the text-level AI rewrite already covers AI wording.
- **Notification analytics** (open / ignored rates) — genuinely can't be
  measured client-side; it needs a Telegram bot **webhook** capturing message
  reads / inline-button callbacks (a persistent server), which this setup
  doesn't have. Delivered/failed is tracked; open-rate is not faked.
- **Duplicate template & version history** — need a multi-template-per-event +
  versioned model (bigger refactor); export/import covers copying for now.
- **Rich button workflows** (action → after-success → …) and **snooze/dismiss**
  — need the same bot webhook to receive callbacks.
- **Image block** — needs `sendPhoto` + image hosting.
- **Public template marketplace** — out of scope for a single-user app.
- Hands-free **scheduled** delivery for time-based events while the app is
  closed still needs the background sender (Vercel cron) noted earlier; "Send
  now" and the sleep-logged auto-send work today.

---

## 🍽️ Nutrition Workspace — foundation

**Purpose.** Replace the old split of "Nutrition" and "Water" with a single
**Nutrition Workspace**. The goal was never calorie counting — it's helping you
eat *consistently*, stay hydrated, save money, and make fewer daily decisions.
One page for the whole day: what you ate, what it cost, how much water you drank,
and a single Health Score that tells you if the day is on track.

**How it works.**
- **One day, one query.** `getNutritionDay(uid, date)` reads the `nutritionLogs`
  collection once and splits it into the per-day summary doc (water + targets,
  id `uid_date`) and the day's **meals** (`docType: "meal"`). No new Firestore
  collections or rules — meals live alongside the water doc, discriminated by
  `docType`, sorted by `sortOrder` then `createdAt`.
- **Unlimited custom meals.** There is *no* hardcoded Breakfast/Lunch/Dinner.
  Every meal is a `NutritionMeal` you create with a **custom name, icon, colour,
  time, notes** and optional **calories / protein / cost**. Quick-start
  templates (Breakfast, Lunch, Dinner, Snack, Pre/Post Workout, Late Night,
  Meal Prep) just pre-fill the editor — everything stays editable.
- **Daily Summary** aggregates the meals + water client-side (`nutritionSummary`)
  into five tiles: **Calories, Protein, Water, Food Cost, Health Score**.
- **Health Score (0–100)** is deliberately *not* calorie-driven: hydration (50%),
  eating consistently (30%), and protein-if-you-track-it (20%). Protein only
  affects the score once you actually log some, so the score never punishes you
  for not counting macros.
- **Meals are cards** with collapse/expand (persisted), a ⋯ menu to **Edit /
  Duplicate / Delete**, and **drag-and-drop reorder** (native HTML5 DnD →
  `reorderNutritionMeals` batch-writes the new order). All meal edits and the
  water controls are optimistic with a quiet reload on failure.
- **Date navigation** lets you page back through previous days (forward stops at
  today); the summary, water, and meals all follow the selected day.

**Features.**
- Single Nutrition Workspace (Nutrition + Water merged).
- Daily Summary tiles: Calories · Protein · Water · Food Cost · Health Score ring.
- Water tracker with unit-aware +/- (glasses / litres / oz), editable goal, and
  a progress bar — still stored on the existing per-day log doc so the Dashboard
  and Insights keep working unchanged.
- Unlimited fully-customizable meals: name, icon (20 choices), colour (10
  swatches), time, notes, calories, protein, cost.
- Collapse/expand, duplicate, delete, and drag-and-drop reorder per meal.
- Quick-start templates + an editable daily protein goal (saved to prefs).

**How to use.**
1. Open **Nutrition**. Tap **Add meal** (or a Quick-start chip), give it a name,
   pick an icon/colour/time, add notes and any macros you care about, save.
2. Log water with the +/- buttons; set your goal inline.
3. Drag meals to reorder, tap a card to collapse it, use ⋯ to duplicate or edit.
4. Watch the Health Score — hit your water goal and eat consistently to push it
   into "Excellent".

**Deferred.**
- **Barcode / food database lookup** and photo logging — need an external food
  API and image hosting.
- **Recurring / templated days** (copy yesterday, meal-prep repeat) — the
  duplicate action covers single meals for now.
- **Trends over time** (weekly protein/cost charts) — the day view ships first;
  analytics can layer on the same `nutritionLogs` data next.

---

## 🥫 Food Library — reusable foods with auto-cost

**Purpose.** Stop re-typing the same nutrition and price numbers into every meal.
Add a food once — chicken breast, oats, your protein powder — and reuse it
everywhere, with cost worked out for you. Nothing here touches an external API;
it's your own private library.

**How it works.**
- **Storage.** Foods live in the existing `nutritionLogs` collection with
  `docType: "food"` (no new Firestore rule needed). The Workspace loads the day
  *and* the whole library in a single query; the library page loads just foods.
- **Per-100 model.** Nutrition (calories / protein / carbs / fat) is entered per
  **100 g or 100 ml** — the packaging standard — and each food has a base unit
  (g or ml). This makes every portion and price derive from one clean base.
- **Auto-calculated cost.** Enter **purchase price** + **quantity purchased**
  and the app shows **cost per gram/ml** and **cost per serving** live — you
  never compute them by hand. Currency is per-food (defaults to your wallet
  currency).
- **Serving sizes.** Define unlimited portions — "100 g", "1 Egg", "250 ml",
  "1 Slice", "1 Cup" — each mapped to how many base units it equals, so macros
  and cost scale correctly per serving.
- **Images** are compressed client-side to a small inline thumbnail (same
  approach as the wardrobe — no paid Storage plan required).

**Features.**
- Unlimited custom foods: name, image, category, brand, notes.
- Nutrition: calories, protein, carbs, fat (per 100 base units).
- Pricing: purchase price, quantity, currency → auto cost/gram + cost/serving.
- Multiple named serving sizes per food.
- **Favorites**, **tags**, **categories**, full-text **search**, **filters**
  (category · tag · favorites · archived), **duplicate**, **archive/restore**,
  **delete**, and **custom drag-to-reorder** sorting (plus sort by name /
  calories / cost / recent).
- Everything is manually editable at any time.

**How to use.** Nutrition → **Food Library** → **Add food**. Fill in what you
know (all optional except a name), add serving sizes, and save. Star the ones
you use daily so they surface first in the Meal Builder.

---

## 🧱 Meal Builder — build meals from foods, totals live

**Purpose.** Turn a meal into a few taps: pull foods from your library, set how
much, and watch calories / protein / carbs / fat / cost total up instantly. As
few clicks as possible.

**How it works.**
- The meal editor now has a **Foods** section. A fast search surfaces favorites
  and recents on an empty query, so most foods are one tap to add.
- Each food line snapshots the food's per-100 macros + cost at add time, so a
  meal's totals stay stable even if you later edit or delete the library food —
  and rendering a day needs zero extra lookups.
- Per line you can **change quantity** (steppers or exact entry), **change
  serving size** (any of the food's portions), **duplicate**, **remove**, and
  **drag to reorder**. Totals recompute on every change.
- A meal with foods shows **live totals**; a meal without foods still supports
  quick **manual** calories/protein/carbs/fat/cost (so nothing forces you into
  the library for a one-off).
- **Meals update the day automatically.** On every meal change the day's macros
  are rolled up onto the per-day nutrition doc, and the Workspace **Daily
  Summary** (Calories · Protein · Water · Food Cost · Health Score, now with a
  carbs·fat readout) reflects it immediately.

**Features.**
- Add foods by searching the Food Library; unlimited foods per meal.
- Change quantity, change serving size, duplicate, remove, reorder (drag & drop).
- Meal notes.
- Auto-calculated Calories, Protein, Carbs, Fat, and Cost — per line and per meal.
- Meal cards on the Workspace list their foods and show the computed totals.

**How to use.** Nutrition → **Add meal** → name it → search and tap foods →
adjust quantity/serving → save. The Daily Summary updates on save.

**Deferred.**
- **Cross-currency conversion** — foods keep their own currency, but there's no
  FX conversion (no external API); totals assume a single currency.
- **Save a built meal back to a reusable template** — meals are per-day today;
  the duplicate action covers repeats within a day.

---

## 🧱 Nutrition architecture — reference-only foods

**Purpose.** Make the whole nutrition system scale and stay consistent by
building it around one source of truth: the **Food Library**. Nothing else
stores nutrition numbers.

**The hierarchy.** Food Library → Meals → Recipes → Templates → Pantry →
Shopping → Daily Nutrition → Analytics. Meals, recipes, templates, pantry and
shopping all **reference foods + quantities only** — macros and cost are always
resolved live from the referenced food. Edit a food's calories or price once and
every meal, recipe, and analytic updates.

**How it works.** A meal/recipe line stores `foodId + quantity + serving`
(label + grams) and a display-name cache — never the nutrition. A resolver layer
(`entriesTotals` / `mealTotals` / `dayTotals`, given a food map) computes
Calories/Protein/Carbs/Fat/Cost on the fly. All nutrition documents live in the
existing `nutritionLogs` collection, discriminated by `docType`
(per-day log · `meal` · `food` · `pantry` · `shopping` · `recipe`), so the
system supports unlimited foods/meals/recipes/templates/categories/tags/
collections/servings **without any new Firestore collection or security rule**.

---

## 📦 Pantry & Shopping (Milestone 4)

**Purpose.** Know what you have, waste less, and shop without thinking hard.

**Pantry.** Track lots of food on hand — each references a Food Library item and
stores quantity remaining (+ originally purchased), unit, purchase date,
expiration date, purchase price, and a low-stock threshold. **Quantities
decrease automatically as you log meals** that use the food: consumption is
drawn FEFO (first-expiring-first) across lots and reconciled per meal on edit or
delete, so the pantry stays honest. Everything stays manually editable.

- Surfaces **Estimated Pantry Value**, **Running Low**, and **Expiring Soon**
  (with days-left), plus one-tap "add to shopping" for low/expiring items.
- Sortable table (name · expiring soonest · least remaining · highest value) and
  custom drag-reorder.

**Shopping list.** Add items by typing (Enter to add) or from the library; send
low/expiring pantry items straight here; **mark purchased**, inline-edit quantity
and cost, reorder (drag), sort (to-buy first · name · cost), and remove. Shows
**estimated shopping cost** (from each food's price, or a manual override), and a
one-tap **"Add to pantry"** restocks purchased items — closing the loop back into
the pantry.

---

## 🥘 Recipes & Meal Templates (Milestone 5)

**Purpose.** Save the meals you make often and log them in one tap.

- **Recipes** (a dish, e.g. *Chicken Rice Bowl*) and **Templates** (a quick-log
  meal, e.g. *Protein Lunch*) are both named sets of Food Library references.
  Calories, Protein, Carbs, Fat and Cost **auto-calculate** from the foods.
- Organize with **collections/folders**, **tags**, **favorites**, **archive**,
  **custom drag-reorder**, and **duplicate**. Search + filter by kind, collection,
  tag, or favorite.
- **Log to today** instantiates a real meal referencing the same foods (which
  also draws down the pantry). Optional image, notes, and an editor that reuses
  the same fast food-builder as meals.

---

## 📊 Nutrition Analytics (Milestone 6)

**Purpose.** Help a student/busy professional make better daily food decisions —
clarity over complexity, no wall of nutrition stats.

**Today at a glance.** Calories, Protein, Water, Food Cost, Meals Logged, and a
Health Score.

**Budget & averages.** An editable **weekly food budget** with a spend-vs-budget
bar, **this-month spending**, and average protein / water per logged day.

**Simple charts** (last 7 / 30 / 90 days): Daily Calories, Protein Trend, Water
Trend, Food Spending, and Meal Frequency — clean mini-bars, no clutter.

**Insight lists.** Most Eaten Foods and Favorite Meals.

**Filters.** Scope everything by date range, meal, food, category, or tag. All
numbers read live from meals (which reference foods), so the dashboard always
reflects the latest logging automatically.

---

## 🍽️ Nutrition redesign — food-first & never-empty

**Purpose.** Opening Nutrition should answer one question — *"What am I eating
today?"* — not demand a pile of decisions first. This pass makes **food the
hero**, removes metadata friction, and makes the page useful before the first
meal is logged.

**What changed.**
- **Food-first logging.** The "Add meal" modal now opens straight to food
  **search + recent foods**, then your **selected foods** with live totals. Name,
  time, icon and notes are tucked into an optional **"Details"** section — the
  meal name is optional and defaults to the time of day (Breakfast/Lunch/Dinner…)
  so the common path needs zero typing. Macros are always derived from the foods;
  manual entry is hidden behind *"Can't find a food? Enter it manually."*
- **Colors removed.** Meals no longer carry a colour — the icon alone is enough.
- **Compact meal cards.** Each card reads like a glance: icon · name · time, the
  foods with amounts, then **kcal · protein · cost**. Scrolling the day feels
  natural.
- **A dashboard that tells a story.** Five tiny metric tiles are replaced by
  **three cards** — **Nutrition** (calories, protein vs goal, meals), **Water**
  (progress bar + quick +/-), and **Budget** (today's food cost + weekly
  budget). All goals are editable inline.
- **Never empty.** Even with nothing logged, the page shows your goals, a
  personality line, **Quick meals** (one-tap logging of saved templates /
  favourite recipes), and a **Shopping reminder** (what to buy, or what's running
  low in the pantry).
- **Personality.** A single helpful sentence up top instead of an unexplained
  score, e.g. *"🥚 You still need about 35g of protein today. You have eggs and
  chicken in your pantry."*
- **Task-oriented navigation.** Tabs are now **🍽️ Today · 🥫 Foods · 📦 Pantry ·
  🛒 Shopping · 📖 Recipes · 📊 Insights** — places you go to do something, not
  database sections.

---

## 🍽️ Nutrition "Today" — command-center dashboard

**Purpose.** A richer, at-a-glance home for the day that still keeps logging fast
and everything editable.

- **Greeting header** ("Good afternoon, Victor 👋") with a date stepper and one
  **Add meal** button.
- **Five metric cards** with progress bars and a plain-language "left" hint:
  **Calories** (vs an editable daily goal), **Protein**, **Water** (with quick
  +/-), **Food Cost** (today, vs weekly budget), and a **Health Score** with a
  Good/Fair badge. Every goal is editable inline.
- **Today's Meals** as rich rows — time, a coloured meal icon, the foods with
  amounts, then **kcal · Protein · Carbs · Fat** columns and cost — sortable by
  time or custom drag order.
- **Right rail**: **Quick Add Food** (search + your recent/favourite foods, one
  tap to log), **Pantry Overview** (what's on hand + expiry), and an inline
  **Shopping List** (check off / add items).
- **Recommended for you** — your saved recipes/templates with calories, protein
  and cost, each one tap to **Add to today**.
- Adds an editable **daily calorie goal**; meal colours return (auto-assigned by
  time of day, fully editable). Everything stays reference-based and flexible.

---

## 🍽️ Nutrition "Today" — premium dashboard pass

Visual + layout overhaul of the Today dashboard from design feedback:
- **Wider canvas** (up to 1700px) so it uses the full screen.
- **One "Today's Progress" card** merging Calories / Protein / Water / Health /
  Food Cost with a large completion ring, replacing five separate boxes.
- **Hero greeting** ("Good evening, Victor 👋") with today's goals and a
  "you've completed X%" line as the focal point.
- **Dominant timeline** — the meals column takes ~70%; Quick Add, Pantry and
  Shopping move to a slimmer right rail.
- **Softer surfaces** — low-contrast borders + subtle shadows (Linear/Notion
  feel) and more generous vertical spacing.
- **This-week charts** — Calories, Protein, Water and Spending sparklines for
  visual feedback.
- **Nicer empty state** and a **richer Quick Add** (Favorites + Recent foods,
  one tap to a prefilled meal).
- Goals stay editable inline; water is logged from the progress card.

---

## 🧭 Premium sidebar — command center

The sidebar was rebuilt from a plain link list into a command center that feels
like Linear / Arc / Raycast, keeping the dark Life OS theme.

- **Premium layout** — wider (248px), generous padding and section spacing,
  cleaner typography hierarchy, aligned icons, soft low-contrast borders and a
  subtle glass/gradient surface. Section titles are quiet; separators are thin.
- **Sliding active pill** — a single rounded indicator smoothly animates between
  items (measured position, ~240ms easing) instead of an instant rectangle.
- **Microinteractions** — icons scale, text brightens, and backgrounds fade on
  hover with 150–240ms easing; nothing flashy.
- **"Today" widget** — greeting (Good morning/afternoon/evening) + date, a
  today's-progress bar (habit completion), and Tasks-left / Habits-left counts.
  It answers "what should I do today?" at a glance.
- **Contextual navigation** — inside a module (e.g. Nutrition) the sidebar
  reveals shortcuts beneath it (Today · Foods · Pantry · Shopping · Recipes ·
  Insights), VS Code / Notion style, without leaving the page.
- **Collapse + hover-expand** — a pin toggle collapses to an icons-only rail;
  hovering the rail smoothly expands it as an overlay (content doesn't reflow).
- **Unified top bar** — matching soft border + glass treatment so the shell
  feels like one system.

---

## 🍽️ Nutrition — 10-improvement pass (logging, guidance, planning)

Three shipped phases turning the workspace into an assistant, not a form.

**Phase 1 — faster logging.**
- **Timeline grouped by meal type**: Breakfast / Lunch / Snacks / Dinner / Late
  night sections with per-section calorie + protein subtotals. Sections are
  *derived* from each meal's own name (custom names still win) or its time —
  nothing hardcoded; time/custom sorting remain.
- **AI photo logging**: "Scan a photo" in the meal dialog sends a compressed
  image to *your own* configured AI provider (Anthropic or Gemini — the same
  browser-side keys as the Agent Hub) which identifies the meal and estimates
  calories/protein/carbs/fat into the editable manual fields. No key → clear
  hint, no external food API needed.
- **Recipe meal-type shelves** (breakfast/lunch/dinner/snack) with browse chips,
  and manual entry auto-opens when the food library is empty.

**Phase 2 — visual feedback & guidance.**
- **Macro split bar** in Today's Progress: where calories came from (protein /
  carbs / fat) with grams and %.
- **Tappable water glasses**: one segment per glass (or 0.25L) — tap to fill.
- **"Fits your remaining ~X kcal"**: after logging, recommendations re-rank to
  recipes that fit what's left of the calorie goal, with a **Perfect fit** badge.

**Phase 3 — planning & trends.**
- **Meal-prep plan** (Recipes): queue recipes, check them off as cooked, total
  prep time, and one-tap *Add ingredients to shopping* (aggregated grams,
  already-listed foods skipped).
- **Use them up** (Pantry): recipes that use your expiring food, one tap to log.
- **Shopping by store aisle**: Produce / Meat & Protein / Dairy / Grains &
  Pantry / Snacks & Drinks / Prepared with per-aisle cost subtotals.
- **This week** (Insights): calories, protein, water and spending vs pro-rated
  targets with ✓/⚠️, plus the week's **best day** and **needs-work day**.

**Deferred (honest constraints).** Water push reminders every 2 hours need a
server that can run hourly — the Vercel Hobby cron is limited to once daily, so
reminders can be built in the Notification Builder but only fire on the daily
run (or live while the app is open). Barcode scanning still needs an external
food database by definition.

---

## 🗓️ Tasks — Notion-style calendar planner (Phase 1)

**Purpose.** Turn Tasks from a flat, easily-empty checklist into a visual
planner you actually *plan* in — see the whole week at a glance, block time,
colour by priority, and drag things around like Notion / Google Calendar.

**How it works.**
- **One model, extended in place.** The `tasks` collection gained optional
  scheduling fields — `startMin` / `endMin` (minutes since midnight, the exact
  convention Sessions already use), plus `energy`, `location`, `tags[]`, and an
  inline `subtasks[]` checklist. Everything is optional on disk: `mapTask`
  defaults old documents, so **no migration and no new Firestore rule** — every
  task you already had still reads and works.
- **Four views, one page.** A `[Today] [Week] [Month] [List]` switcher on
  `/tasks` (Week is the default). Week and Month reuse the calendar's own date
  math (`startOfWeekKey`, `monthGrid`, `addDays`); Sessions' `rangeLabel` /
  `minToLabel` render the time blocks — so the planner feels native, not bolted
  on. All the domain logic lives in `lib/tasks.ts`.
- **Time-of-day lanes.** Each day column is split into **All day · Morning
  (6–12) · Afternoon (12–5) · Evening (5–11)**. A task falls into a lane from
  its start time; untimed tasks sit in "All day".
- **Drag to reschedule.** Native HTML5 drag-and-drop (no new dependency) — drop
  a task on any day/lane and it re-dates + re-times optimistically (keeping its
  duration), with an Undo-style confirmation toast; it reverts if the write
  fails. Dropping on "All day" clears the time.
- **Colour by priority** 🔴 High · 🟡 Medium · 🟢 Low — a left bar and dot on
  every card.
- **Click for details.** A slide-in sheet shows the full task (status, date,
  time + duration, goal, project, energy, location, tags, description, and a
  tickable subtask checklist) with Complete / Edit / Delete actions.
- **Today "at a glance."** Open tasks, hours blocked, high-priority count, and
  an estimated finish time, above the day's schedule by block.

**Features.**
- Week (default), Today, Month, and List views with a shared toolbar + quick-add.
- Drag-and-drop rescheduling between days and time blocks.
- Rich task form: date, start time + duration → **auto-calculated end time**,
  priority, goal + (goal-scoped) project, energy (1–10), location, tags, and
  subtasks with optional minute estimates.
- Priority colour-coding, per-card time/duration, subtask progress, tags, and
  location.
- Click-through detail sheet with subtask ticking; reversible delete with Undo.
- Month grid with per-day priority dots + overflow count; List view with
  Open / Today / Overdue / High priority / Done / All filters.

**How to use.** Open **Tasks**. Quick-add drops a task on the focused day, or
hit **New task** for the full form. Drag cards between days and Morning/Afternoon/
Evening to reschedule. Click a card to see everything and tick subtasks. Switch
to Month for the big picture or List to filter.

**Deferred (Phase 2).** Recurring tasks that auto-populate (daily/weekly/
monthly), a drag-from-backlog planning board for unscheduled tasks, "smart
scheduling" suggestions, and time-based reminders — the same client-only /
Vercel-cron constraints as the notification sender apply to reminders.

---

## 🗓️ Tasks — planner Phase 2 (recurring · planning board · auto-schedule · reminders)

**Purpose.** Finish the planner: stop re-adding the same tasks, make organising
a loose backlog effortless, and let the app do the tedious slotting.

**Recurring tasks (auto-populating).**
- The task form gained a **Repeat** control — **Daily / Weekly (pick weekdays) /
  Monthly (day-of-month)** with an optional **Until** date. A repeating task
  becomes a *series head*; the rule lives inline on the task (`recurrence`), so
  **no new collection or Firestore rule**.
- On load, a bounded generator **materializes real occurrence docs** up to a
  35-day horizon (`planRecurringOccurrences` → `generateRecurringOccurrences`,
  one batched write). Because they're real tasks, occurrences drag, complete,
  and edit exactly like any other — no virtual-event special-casing anywhere.
  It's idempotent (de-dupes by `seriesId`) and copies the head's time block,
  priority, tags, energy and a fresh (undone) subtask checklist. Editing the
  head changes *future* occurrences; already-generated ones stay put.

**Planning board (drag-from-backlog).**
- A new **Plan** view puts a **Backlog** of undated tasks beside the week grid.
  **Drag a backlog task onto any day + time block** to schedule it; **drag a
  scheduled task back onto the backlog** to unschedule it. Same native HTML5
  drag-and-drop as the week view — the backlog is just another drop target.

**Smart auto-schedule.**
- **Auto-schedule** packs the backlog into the earliest free **work-hour**
  slots (9am–6pm) over the next 7 days, **highest priority first**, never
  overlapping existing time blocks and honouring each task's own duration
  (`autoSchedule`). Deterministic and offline — no AI key needed — applied
  optimistically with a summary toast.

**Reminders.**
- Tasks carry **reminder lead times** (At start · 5/10/15/30 min · 1 hour ·
  1 day before), chosen in the form and shown in the detail sheet. When a task
  is within its lead time, a quiet **"starting soon" banner** surfaces it in-app
  (refreshed each minute). *Honest constraint:* phone push still depends on the
  once-daily Vercel-cron notification run — the lead-time data is stored ready
  for it, but sub-daily push isn't possible on the current plan.

**Back-compatible, as before.** `recurrence`, `seriesId` and `reminders` are all
optional on disk and defaulted by `mapTask`, so every existing task keeps
working with no migration.

---

## 🗓️ Tasks — planner Phase 3 (true time-grid · hover · month workload)

**Purpose.** Make the Week view read like a real calendar (Notion / Google
Calendar), not coarse buckets — and make an empty calendar explain itself.

**True hourly time-grid Week view.** The Week view was rebuilt from three
Morning/Afternoon/Evening lanes into a proper **TIME gutter × 7 day columns**
grid: an **All-day row** on top, then hourly rows **6am–10pm**. Each task sits
in its start-hour cell as a compact colored card; **drop a task on any day +
hour cell** to reschedule to that exact time (it keeps its duration), or drop on
the All-day row to make it untimed. Today is highlighted; the whole grid scrolls
horizontally on small screens. Scheduling is now expressed as a precise start
minute everywhere (drag, drop, quick-add), not a bucket.

**Hover previews.** Hovering a task card shows a rich popover — priority, time +
duration, goal, energy, location, the subtask checklist, and tags — rendered
through a portal so the scrolling grid never clips it. Click still opens the
full editable detail sheet.

**Month workload.** Month cells now show **both** signals from the mock: the
priority dots (+overflow count) *and* a **workload bar** underneath — □ light
(<2h) · ■ normal (2–6h) · ■■■ heavy (6h+) — from each day's open-task time.

**Never-empty calendar.** When the week (or today) has nothing scheduled but you
have unscheduled tasks, a hint appears with **Open planner** and **Auto-schedule**
buttons — because an empty grid usually means tasks just need dates/times, not
that anything is broken.

---

## 🗓️ Tasks — Week view visual overhaul (spacing · proportional blocks)

**Purpose.** The time-grid worked but read as cramped. This pass makes it
spacious and scannable — a real calendar surface.

- **Duration-proportional blocks.** Tasks are now absolutely positioned by time:
  a 2-hour task is literally twice as tall as a 1-hour one, sized against **88px
  per hour** (was ~46px). Overlapping tasks split the column **side-by-side**
  (an overlap-column layout), so nothing hides behind anything.
- **Roomier grid.** Wider day columns (min 158px, growing to fill), a cleaner
  time gutter with labels centered on each hour line, and a distinct **all-day**
  band on top.
- **Vibrant priority colors.** Every task card now carries a priority-tinted
  surface — 🔴 rose / 🟡 amber / 🟢 emerald (border + fill + hover) — so
  priority reads at a glance across all views, not just a thin bar.
- **Click-empty-to-add.** Clicking any empty spot in a day opens the New-task
  form prefilled to that day and (30-min-snapped) time. Dropping a task on the
  grid snaps to the same 30-min steps.
- Today's column is tinted; the grid scrolls horizontally when the window is
  narrow so all seven days stay usable.

---

## 🗓️ Tasks — interaction & motion pass (feel like a calendar, not a dashboard)

**Purpose.** Shift the planner from "boxes of content" toward direct
manipulation and calm motion — the Google Calendar / Linear / Arc feel. Focus on
*how it behaves*, not more panels.

- **Drag-to-resize (direct manipulation).** Every week event has a bottom grab
  handle — **drag it to change the task's duration live**, snapped to 15-min
  steps, persisted on release with a toast (optimistic, reverts on failure). The
  block grows/shrinks under your cursor in real time.
- **Shared motion system.** Added soft easing tokens (`ease-smooth`,
  `ease-spring` — never linear). Cards **gently raise 1px on hover** and settle
  on press; **buttons compress** slightly when clicked (app-wide); event blocks
  **interpolate** as they move/resize; transitions sit in the 120–250ms range.
  All of it respects the existing reduced-motion guard.
- **Canvas de-clutter.** The week grid lost its heavy boxes: no outer border, a
  translucent **blurred sticky header**, hairline hour lines and column
  dividers, and more breathing room. It reads as one continuous surface rather
  than a stack of cards.
- **Hover-reveal actions.** Row action menus (List / goal tasks) stay hidden
  until you hover or focus the row, so the default view is quiet.
- **Click-empty-to-create** and **drag-to-move** already land inline — no modal
  unless you open the full editor — keeping the common paths tactile.

*Not done here (by design):* the extra right-rail dashboard panels from the
reference shot (Upcoming / Overview / Focus Time) were intentionally skipped —
the brief was to reduce cards and sharpen interaction, not add UI. Easy to add
later if wanted.

---

## 🎯 Goals — Milestone 1: flexible measurement engine + fixes

**Purpose.** Stop forcing every goal into a 0-100% bar. Measurement type is now
a first-class, per-goal choice, because "learn C1 English", "apply to 300 jobs"
and "save 2000 MDL" are measured completely differently.

**Measurement types (chosen per goal, editable later).**
- **Percentage** — a manual 0-100 slider/number you set directly.
- **Count toward target** — current / target with a user-defined unit
  ("47 / 300 applications", "1200 / 2000 MDL"), using the app's directly-typeable
  number fields.
- **Milestone checklist** — progress is the weighted completion of the goal's
  milestones (built in Milestone 2).
- **From tasks (auto)** — the legacy behavior, kept: progress from completed
  linked tasks/projects, so existing goals keep working unchanged.
- **Linked time** — derived from hours logged in **Sessions** tagged to this
  goal (read-only), e.g. "12.5 / 40 h".
- **Composite** — a weighted blend of several sub-metrics (e.g. 40% study hours +
  40% practice tests + 20% mock exam). Powerful but never forced.

The engine lives in `lib/goals.ts` (`computeGoalProgress`) and the data layer
recomputes and persists a goal's `progress` for every derived type via
`recomputeGoalProgress` (called on task/goal changes), while **Percentage stays
manual and is never clobbered**.

**Bug fixes.**
- **"NaNd left" is gone.** Day math never runs against a missing/invalid date —
  goals with no target date now show a clear **"No deadline set"** badge instead.
- **Badge row redesigned.** Status, priority, category and deadline each get a
  distinct-but-harmonious pill (solid status, flag-coloured priority, muted
  category tag, tone-coloured deadline) so they're scannable at a glance.

**Also.** Optional **start date** and **target date** (both optional); a
**user-extensible category** (free text with common suggestions, no locked
list); a per-goal **icon + colour** for visual distinction on the list; and
every numeric field remains directly typeable. All new fields are optional on
disk and defaulted in `mapGoal`, so existing goals migrate with no work.

---

## 🎯 Goals — Milestone 2: micro-goals (sub-goal hierarchy)

**Purpose.** Make big goals tractable instead of one scary percentage — break a
goal into weighted milestones that drive its progress and tie into tasks.

**How it works.**
- **Embedded, no new collection.** Milestones live as an array on the goal
  document (the app's established pattern — like recurring rules on Budget), so
  there's **no new Firestore collection or security rule** to deploy.
- **Each milestone measures itself** — a **checkbox**, a **count toward target**
  (with unit, e.g. "2 / 3 exams"), or its own **sub-step checklist** (nesting
  one level deep, opt-in). Each has a **weight**, an optional **due date**
  (independent of the goal), and a completion date stamped when done.
- **Milestones drive the goal.** A goal set to the **Milestone checklist**
  measurement computes its overall % from the **weighted completion** of its
  milestones automatically — you never keep the top-level number in sync by hand.
- **Tied to tasks.** A milestone can **link existing tasks**; when all linked
  tasks are complete it either **auto-completes** (if you flagged it) or shows a
  *"linked tasks done — mark complete?"* nudge. The detail view lists each linked
  task with its done state.

**In the goal detail view** milestones are an **ordered, collapsible checklist**:
drag to reorder, a per-milestone **progress bar**, inline editing of the count
value and sub-steps, due/weight/linked-task meta, and add/edit/delete — with the
goal's overall bar updating live as milestones change.

---

## 🎯 Goals — Milestone 3: progress history, trend & realistic pacing

**Purpose.** A single current % doesn't tell you if you're on track. This adds a
time dimension.

- **Progress history.** Every progress change records a **daily snapshot**
  (`progressLog`, embedded + bounded to ~400 days) — logging is centralized in
  `recomputeGoalProgress`, so manual %, count edits, milestone completion, task
  completion and linked-session changes all get captured (one entry per day).
- **Progress-over-time chart** on the goal detail — a line chart of the log so
  you can see acceleration, plateaus or stalling at a glance. It only appears
  once there are **≥2 data points** (same "no fabricated trend on day one" rule
  used elsewhere).
- **Pace projection** — plain-language status from **simple linear math**
  (progress velocity over the last ~4 weeks vs. the target date): **On track**,
  **Ahead of schedule**, **Behind schedule**, or **No deadline set**. It's shown
  as an estimate ("≈ 82% by the deadline at this pace (estimate)"), never a
  guarantee, and never a forecasting model — and it's gated on having enough
  history.
- **Trend arrow** — up/down with the change vs ~a week ago, gated on ≥2 points.
- **Stale-goal detection.** An active goal with no progress entry in a
  **configurable number of days (default 14, per-goal)** gets a **"Needs
  attention"** flag on the Goals list, so an important goal can't silently die.

---

## 🎯 Goals — Milestone 4: unified detail & daily integration

**Purpose.** Bring everything into one strong goal page and connect goals to the
rest of the app instead of leaving them on an island.

- **Unified goal detail** — header (icon/colour, title, badges), measurement
  summary, the progress-over-time chart + pace (M3), the milestone checklist
  (M2), linked tasks/projects, a **linked-sessions** summary (hours logged toward
  the goal), and a free-text **journal / reflections** section (dated entries,
  add + delete). *(Trackers aren't goal-linked in the data model, so "linked
  trackers" surfaces as linked sessions only.)*
- **Quick update from the Goals list** — for the two manually-updated types you
  can set progress in one or two clicks right on the list card (type the %,
  or the current count toward target); it records a history snapshot just like a
  "log today". Derived types (tasks/milestones/linked) update themselves.
- **Dashboard integration** — the single most urgent active goal (stale →
  behind-schedule → nearest deadline) surfaces as an amber callout in the
  dashboard's Active-goals tile, so it's not something you have to remember to
  check on a separate page.
- **Weekly Review integration** — a "Goals this week" section lists each active
  goal with its progress bar and pace status right inside the review flow, so
  reflecting on goals happens as part of the routine that already exists.

---

## 🧮 Finance — floating calculator + sticky transactions header

**Floating calculator (app-wide).** A small draggable calculator opens from a
persistent bottom-right button on every page.
- Basic arithmetic only — add, subtract, multiply, divide, **percentage**,
  clear, backspace, decimal (no scientific/history, by design).
- **Draggable anywhere** (stays put while the page scrolls underneath) and
  **remembers its last position** + open state in local storage.
- **Minimizes** back to the small floating icon without losing the current
  value, and reopens where you left it.
- **Insert result** drops the current value straight into the **last numeric
  field you focused** (transaction Amount, quick-add Income/Expense, or any
  numeric input across the app) — the real time-saver. It tracks the last
  focused numeric input and writes via the native setter so React/controlled
  fields pick up the change.
- Matches the app theme (card, rounded-2xl, shadow, violet accents) and keeps a
  safe margin from screen edges.

**Sticky Transactions header.** The Transactions table (Date · Day · Type ·
Category · Description · Income · Expense · Balance) now scrolls inside its own
bounded area with the **header row pinned to the top**, so the columns are never
ambiguous no matter how far you scroll. The sticky header is opaque with a
hairline bottom border (an inset shadow so it survives `border-collapse`), and
numeric columns stay right-aligned while text columns stay left-aligned.

---

## 💳 Finance — Accounts / cards / wallets

**Purpose.** Track each card/account separately instead of one money pool, with
every transaction attributable to a specific account.

- **User-defined accounts** — name, description, colour + icon, an extensible
  **type** tag (Cash/Debit/Credit/Savings/Other, free text), optional per-account
  **currency** override, and **archive** (retire without losing history). No
  hard limit on how many. Stored **embedded on the budget doc** (no new
  collection or security rule). The old fixed Wallet/Safe are **seeded as the
  first two accounts** from the previous opening balances, so every existing
  transaction keeps its account reference — zero migration for you.
- **Balance = transactions + a starting balance.** Each account's live balance
  is `startingBalance + income − expenses on it`; the starting balance is a
  directly-editable correction for real-world drift (bank fees, etc.).
- **Every transaction carries an account** — quick-add, the full add/edit form,
  and transfers all pick from your accounts, defaulting to the last-used one.
- **Transfers** move money between any two accounts (paired entries) and update
  both balances without counting as income or spending.
- **Accounts overview** — a prominent **card grid** at the top of Finance: a
  colour-tinted card per account (icon, name, type, live balance) plus an
  **"Add card"** tile. Click a card to edit it; the **Manage** dialog does inline
  create/edit of *every* value (name, description, type, colour, icon, currency,
  starting balance) + archive, and deleting an account that still has
  transactions **archives instead of hard-deleting** so history is preserved. A
  compact Net-worth breakdown stays in the sidebar.
- *No FX conversion between differing account currencies (each shows in its own
  set currency), and balances stay manual/transaction-derived — no bank API.*

---

## 🪙 Finance — color-coded cash counter

**Purpose.** Count physical cash by a personal colour convention (yellow = 1000,
blue = 2000, …) instead of bill-by-bill.

- **Fully user-defined legend** — each entry is a colour + label + value, with
  **no locked defaults**. On first use it offers a one-tap example (Yellow 1000 ·
  Blue 2000 · Red 5000 · Green 10000) that you can then rename, revalue,
  recolour, **reorder**, add to, or delete. The legend is stored embedded on the
  budget doc (no new collection/rule).
- **Fast counting** — a "Count cash" tool (from the Accounts panel) shows each
  colour with big +/- steppers and a directly-typeable count, and a **big live
  total** that updates instantly as `Σ(count × value)`.
- **Save as account balance** — apply the counted total straight to a chosen
  account (sets its starting balance so the live balance equals the count) —
  ideal right after counting a cash wallet.
- **Reset counts** zeroes the counts for a fresh count while leaving the legend
  definitions intact.

---

## 💳 Finance — Accounts polish (logos, flexibility, currency-safe net worth)

Refinements that make the Accounts system feel finished.

- **Custom logos per account.** Upload a bank/card logo (Maib, Revolut, …),
  compressed client-side the same way as Wardrobe photos and shown as the
  account's avatar on the cards, the manager, and the transaction picker. No
  upload → clean fallback to the (now much larger) preset icon + colour palette.
- **Everything is editable, any time.** Name, **type** (free text — add your own
  like "Crypto wallet"), starting balance, currency, description, colour, and
  icon/logo are all editable inline in the manager, not just at creation. Added
  the missing description field too.
- **Cash counter is fully decoupled.** The colour legend + counter never sync to
  a balance. "Save as balance" is a one-time manual copy, with an explicit note
  saying so — no ongoing link is created or shown.
- **One Savings Goal.** Removed the duplicate; the single widget lives on the
  main Finance overview.
- **Currency-safe Net Worth.** Balances in different currencies are **subtotaled
  per currency** ("MDL accounts", "USD accounts") instead of being blended into
  one misleading number; the headline shows the budget-currency total with the
  others listed alongside.
- **More polish:** drag to **reorder** account cards; **click a card to filter
  the transaction list** to it (a real entry point); mark one account **primary**
  (star) so Quick Add pre-selects it; standard **empty state** when there are no
  accounts; and the mystery lock icon is now a real, explained
  **"hide balance until tapped"** privacy toggle.

---

## 🔥 Habits — drag to reorder

The Habits **Table** view now lets you **drag a habit row into any position** (a
grip handle appears on hover). The new order persists via `reorderHabits` and is
used everywhere habits are listed. Cell toggles and the emoji/colour button keep
working — only the left cell initiates a drag. The emoji picker (both the quick
icon/colour editor and the create form) also gained a **much larger set** —
health, food & drink, learning, work, creative, home, nature, feelings & symbols
— in a taller, scrollable grid.

---

## 🧭 Sidebar — colour-coded sections (and Routines removed)

- **Removed the Routines** section — the `/routines` route and its sidebar/mobile
  nav entry are gone.
- The sidebar is less flat now: each section (Hub · Plan · Track · Wardrobe ·
  Review) has its **own accent colour** shown as a dot beside the section label,
  a tinted hairline divider in the collapsed rail, and **section-tinted icons**
  (the active item still uses the primary violet + sliding pill). Same treatment
  on the mobile menu's section headers.

---

## ⚡ Finance — faster tab load

Two fixes so opening Finance feels instant:
- **Session cache** — after the first load, re-opening Finance renders the last
  snapshot immediately and refreshes in the background, instead of showing a
  full skeleton reload every time.
- **Lean account logos** — custom logos are now compressed to a small avatar
  (~96px, ~20 KB) instead of the full Wardrobe thumbnail (~140 KB). Since every
  account is stored inline on the single budget document, this keeps that doc
  small — faster to download on each load and safely clear of Firestore's 1 MB
  document limit (which large logos could otherwise blow past, causing save
  errors).

---

## 🎯 Goals — Productivity Overhaul, Phase 1: Focus & Today

**What it is.** The first phase of turning Goals from a list you *look at* into a
system you *act on*. Instead of showing every goal as an equal row, the page now
answers two questions first: **which goals matter right now**, and **what's the
next thing to do**.

**How it works.**
- **Focus goals.** Every goal card has a **☆ star**. Star your 1–3 most
  important goals and they rise into a dedicated **Focus** section at the top
  (subtly ringed), while everything else drops to a **More goals** section
  below. Toggling is instant (optimistic) and persists on the goal doc via a new
  `focus` flag — no new collection needed. There's also an "Unfocus/Focus" item
  in each card's ⋯ menu.
- **Next action, everywhere.** A new engine (`goalNextAction`) computes the single
  most concrete next step for each goal, preferring the most actionable unit
  available: the earliest open **task** (by due date), else the first unchecked
  **step** inside the first open milestone, else the first open **milestone**.
  Each card shows a muted "Next: …" line so you always know the immediate move.
- **Today's Momentum.** A highlighted strip at the very top lists the next action
  for each focus goal with a **one-click complete** — check it off and the goal's
  progress recomputes and the next action rolls forward automatically. This is
  the daily driver: open Goals, knock out the momentum list, done.
- **Focus nudge.** On an account with many active goals and none starred yet, a
  gentle banner explains that focus compounds and to star your top 1–3. The Focus
  header also hints when you've starred more than 3.

**How to use it.**
1. Open **Goals**. Click the ☆ on your 1–3 most important goals.
2. Each morning, work the **Today's Momentum** strip — tick off the next step on
   each focus goal.
3. Everything else stays available under **More goals**; promote/demote focus any
   time with the star.

> **Next.** Phase 2 (Momentum & health): a real momentum score, on-track/at-risk
> pacing, streaks, a stall radar, and a wins log.

---

## 🎯 Goals — Productivity Overhaul, Phase 2: Momentum & health

**What it is.** Signals that tell you, honestly and at a glance, which goals are
*moving* and which have gone quiet — replacing meaningless numbers with a plain
read on health.

**How it works.**
- **Momentum score + label.** A new engine (`goalMomentum`) blends recent
  velocity (%/week over the last 14 days) with how recently progress last
  *increased* into one 0-100 score and a plain label: **Flying / Steady /
  Warming up / Stalled** (or "New" until there's history). Every goal card shows
  a coloured momentum chip with either "+X%/wk" or "idle Nd".
- **Header stat row.** Four honest tiles across the top: **Active**, **At risk**
  (stale *or* behind pace), **Avg velocity** (mean %/week across active goals with
  history — the real version of the screenshot's "+4.2%/wk"), and **Wins (7d)**
  (milestones completed this week).
- **Stall radar.** A card listing the active goals that haven't moved lately,
  worst first, each with how many days it's been idle — one click opens the goal.
- **Recent wins.** A companion card celebrating the milestones you completed in
  the last two weeks. Momentum needs proof.
- **At risk / behind** reuses the existing pace engine (linear velocity vs. the
  target date) so "at risk" means something concrete.

**How to use it.** Glance at the stat row and momentum chips to see where you
stand; work the **Stall radar** to un-stick quiet goals; enjoy the **Recent
wins**. No data entry — it's all derived from the progress you already log.

> **Next.** Phase 3 (Structure & breakdown): Key Results (OKR), goal templates,
> dependencies/blocking, and life-area grouping.

---

## 🎯 Goals — Productivity Overhaul, Phase 3: Structure & breakdown

**What it is.** Better goal *architecture* — faster ways to create well-formed
goals, a clearer measurement model, and tools to organise and sequence a long
list.

**How it works.**
- **Goal templates.** The "New goal" dialog opens with a row of one-click
  templates — **Learn a language** (A1→C1 milestones), **Get certified**,
  **Save money** (count), **Land a job**, **Get fit**, **Read more** — each
  pre-fills the title, icon, colour, category, measurement type, and a starter
  **milestone tree**, so a new goal arrives already broken into steps that the
  Focus/Momentum engines light up.
- **Key Results (OKR).** The "Composite" measurement is now presented as proper
  **Key Results**: an objective measured by 2–4 weighted key results, each with
  its own current/target/unit. The goal's detail page renders a **Key Results
  card** with a progress bar per KR; overall progress is the weighted blend.
- **Dependencies / blocking.** A goal can be marked **Blocked by** one or more
  other goals (a picker in the form). Until those finish, the goal shows a 🔒
  **Blocked** badge (naming the blocker), a red banner on its detail page, and
  counts toward a new **Blocked** tile in the header stat row. Stored as a
  `dependsOn` array on the goal doc — no new collection.
- **Life-area grouping.** A **Group by area** toggle on the goal list reorganises
  everything below Focus into **area sections** (Career, Health, Finance,
  Education…) — each with a count and a **roll-up progress bar** — so a list of
  18+ goals stays scannable. Toggle back to the flat grid any time.

**How to use it.** Create goals fast from a **template**; for outcome-style goals
pick **Key Results (OKR)**; wire up **Blocked by** to sequence work; hit **Group
by area** when the list gets long.

> **Deferred.** Goal reminders/notifications (the old Milestone 5) remain out of
> scope for now, by choice.

---

## ⚡ Quality pass (a) — speed & shared foundations

**What it is.** The first step of an app-wide quality pass: make the whole thing
feel instant and start sharing UI primitives instead of re-inventing them.

**How it works.**
- **Persistent offline cache.** Firestore now uses a **persistent IndexedDB cache**
  (multi-tab). Reads are served from local storage first — so re-opening any page
  is instant — while the SDK revalidates in the background, and the app keeps
  working **offline**. One change in the Firebase config; every page benefits.
- **No more write-on-read.** Opening a goal's detail page used to write a progress
  snapshot to Firestore *every visit*. Progress is already recomputed on every
  real change (task/subtask/milestone/count edits), so that wasteful write is
  gone.
- **Instant Goals list.** The Goals page keeps a session snapshot and renders it
  immediately on return (no skeleton), revalidating in the background — the same
  trick the Finance tab uses.
- **Shared `StatTile`.** The metric tile is now a reusable primitive
  (`components/ui/stat-tile.tsx`) instead of a one-off, ready for the dashboards.

---

## 🧭 Quality pass (b) — Goals meet the dashboard

**What it is.** The dashboard already unifies your day (the Priority Stack merges
sleep, habits, water, trackers, tasks and sessions into one ranked list) — but it
ignored the whole Goals module. This connects them so the daily driver actually
includes your goals.

**How it works.**
- **Momentum on the dashboard.** A new **Momentum** card surfaces the *next
  action* on each of your **focus goals** — the same one-click-complete strip
  from the Goals page, now front-and-center on the dashboard (above the Priority
  Stack), each with its momentum chip. Ticking one off updates the goal and rolls
  its next step forward, everywhere.
- **Shared completion.** Both the Goals page and the dashboard now complete a
  goal's next action through one shared helper (`completeGoalNextAction`) — no
  duplicated logic, so the two surfaces always behave identically. (It also shed
  weight from the Goals page.)
- **No extra fetches.** The dashboard already loaded your goals and tasks, so the
  Momentum card is pure derived data.

**How to use it.** Star 1–3 focus goals on the Goals page; their next steps now
greet you on the dashboard every morning, alongside your logging nudges.

---

## 🧰 Quality pass (c) — offline badge, shared primitives, dashboard speed & tests

**What it is.** A grab-bag of foundation wins from the honest app review.

**How it works.**
- **Offline badge.** When you lose connectivity an **"Offline"** pill appears in
  the top bar; paired with the persistent cache, reads still work and writes queue
  and sync when you reconnect.
- **Shared UI primitives.** Added `PageHeader` and `EmptyState` alongside the
  shared `StatTile`, and adopted them on the Goals page — the start of replacing
  each page's bespoke header/empty-state with one consistent vocabulary.
- **Instant dashboard.** The dashboard (the landing page) was the worst offender:
  ~12 queries with no cache, a full skeleton on every visit. It now keeps a
  session snapshot and renders instantly on return, revalidating in the
  background — matching Goals and Finance.
- **Legacy cleanup.** The dashboard no longer reads the deprecated `progressType`
  goal field (it uses `measurement`), keeping goal-progress logic consistent
  app-wide.
- **A test suite.** Added **Vitest** with **31 unit tests** covering the pure
  logic that matters most — the goal engine (progress, momentum, next-action,
  stale, blockers, milestones), the dashboard priority stack, and the money math
  (income/expense totals excluding transfers, account balances, cash counter).
  Run with `npm test`. Test files are excluded from the production build.

---

## ⚡ Quality pass (d) — app-wide instant navigation

**What it is.** A reusable caching hook so pages stop re-fetching (and flashing a
skeleton) on every visit — the fix rolled out beyond the few pages that had
bespoke caches.

**How it works.**
- **`useCachedResource(key, fetcher)`** — a tiny stale-while-revalidate hook over
  a shared module cache. It paints the last snapshot for a key instantly, then
  revalidates in the background; `refresh()` re-fetches without flashing the
  skeleton, `mutate()` applies optimistic updates in place, and
  `invalidateCache()` clears it (e.g. on sign-out).
- **Adopted on Projects, Time Audit, Dependencies, Calendar, Sessions, Trackers,
  and the Notifications inbox** — each now opens instantly on repeat visits.
  Read-only pages use `refresh()` after edits; pages with optimistic updates
  (Trackers, Notifications) use `mutate()`. More pages to follow; the pattern is
  a drop-in.

---

## ⌘ Command palette + global quick-add

**What it is.** Press **⌘K** (Ctrl-K) anywhere to open a command palette — the
"this is a real app" moment.

**How it works.**
- **Jump anywhere.** Every page in the app is a command; type a few letters and
  hit enter to navigate.
- **Search your stuff.** Start typing and it searches your **goals, tasks,
  habits, and sessions** live — pick one to jump straight to it.
- **Natural-language capture.** Whatever you type becomes something you can
  make: "Create task “…”" is always offered, and typing a money amount (e.g.
  "save 500") offers "Create goal: Save $500" — created on the spot with a toast.
- **Create from anywhere.** "New task / New goal / New habit" open the real
  create dialogs without leaving the page you're on — also available from a new
  **＋ quick-add** button in the top bar (and a **Search ⌘K** button beside it).
- Full keyboard control (↑/↓ to move, enter to run, esc to close); mounted once
  at the app shell so it's global. After a create it invalidates the shared cache
  so pages pick up the new item.

**How to use it.** Hit **⌘K**, type — a page name, a goal, a task, or "new goal".

---

## 🎉 Delight & motion

**What it is.** Small moments that make the app feel alive instead of static.

**How it works.**
- **Confetti on completion.** Finishing a **milestone** — checking it off, or
  completing it from Today's Momentum (on the Goals page or the dashboard) — sets
  off a dependency-free confetti burst. Reduced-motion is respected.
- **Count-up numbers.** The Goals stat row (Active / At risk / Wins / Blocked)
  animates its numbers up instead of snapping, via the shared `StatTile` (now
  accepts any content) + `AnimatedNumber`.

**How to use it.** Just finish a milestone — enjoy the moment.

---

## 🎨 Accent colour — make it yours

**What it is.** Personalise the whole app's accent colour.

**How it works.**
- **Settings → Appearance → Accent colour** offers a row of swatches (Violet,
  Blue, Sky, Emerald, Amber, Orange, Rose, Pink). Pick one and it instantly
  re-themes every button, link, highlight, and focus ring across the app, in both
  light and dark mode.
- It works by overriding the theme's `--primary` / `--ring` CSS variables on the
  root element and saving your choice locally, so it's applied on every visit.

**How to use it.** Settings → Appearance → tap a colour.

---

## ✨ Visual polish pass (surfaces & type)

**What it is.** A tasteful, app-wide lift so it reads as a premium product rather
than flat default cards — done at the shared-component level so every screen
benefits at once.

**How it works.**
- **Depth on every card.** A new base treatment gives cards a soft shadow in
  light mode and a subtle top-highlight sheen + gentle gradient in dark mode, so
  surfaces feel raised instead of flat. One class on the shared `Card`, so it
  applies everywhere.
- **Sharper headings.** Page titles get tighter letter-spacing for a more
  intentional, designed feel.
- **Accent-aware glow.** The dark-mode corner glow now tints with *your* chosen
  accent colour instead of a fixed violet.
- **Refined dashboard hero.** The greeting banner gains a soft accent halo and an
  icon chip — a more premium first impression.

---

## 🔔 Toasts & Undo

**What it is.** Actions now give feedback, and destructive ones are forgiving.

**How it works.**
- **Toast system.** A global, bottom-centre toast (dismissible, auto-hiding) with
  an optional inline action button. Available anywhere via `useToast()`.
- **Create confirmations.** Creating a task/goal/habit from ⌘K or the ＋ quick-add
  shows a "… created" toast.
- **Undo on completion.** Completing a goal's next action from Today's Momentum
  shows "Nice — marked done" with **Undo** that reverts it.
- **Forgiving delete.** Deleting a goal no longer needs a scary confirm — it
  disappears with a **"Deleted … · Undo"** toast and is only really removed after
  a short grace period; Undo brings it straight back.

**How to use it.** Just act — the toast tells you it worked, and offers Undo when
it matters.

---

## 🗓️ Time-blocking + reminders

**What it is.** Turn intentions into scheduled time, and get nudged about what's
slipping.

**How it works.**
- **Schedule the next action.** Every row in **Today's Momentum** (on the Goals
  page *and* the dashboard) now has a **📅 schedule** button that creates a
  planned **Session** for that action — tomorrow, 9–10am, linked to the goal —
  with a toast that jumps you to Sessions. Closes the plan→do loop.
- **Reminder nudge.** The dashboard surfaces the one goal that most needs
  attention today (stale → behind pace → nearest deadline) as a tappable amber
  banner, instead of burying it.

**How to use it.** On a focus goal's next step, hit 📅 to block time for it; watch
the dashboard banner for whatever's slipping.

---

## 🧱 Finance — begin breaking up the monolith

**What it is.** The first, safe step of splitting the 2245-line Finance page.

**How it works.**
- Extracted **11** self-contained presentational + inline-edit widgets (Panel,
  Delta, StatCard, Sparkline, QuickAdd, Donut, Heatmap, IncomeExpenseBars,
  AmountInput, NoteInput, CategorySelect) into
  `components/expenses/finance-widgets.tsx`. They're pure, prop-driven leaf
  components, so the move is behaviour-neutral and the page imports them back.
  Donut/Heatmap take their page-local helpers (`iconFor`, `formatDayLabel`) as
  props — no risky relocation.
- The Finance page dropped from **2245 → 1940 lines** and gained a reusable
  widget library.

> **Next.** Continue the split (transactions table, accounts grid, charts
> section) and the same treatment for the habits/dashboard monoliths.

---

## 💸 Finance — pace-aware budget envelopes

**What it is.** The existing per-category "Category budgets" bars became a
spending coach.

**How it works.** Each envelope now shows a **projection + pace** line: how much
you're on track to spend by month-end at the current rate, and whether you're
**On pace**, **Ahead of pace** (spending faster than the month is elapsing), or
already **Over** (by how much). Colours stay green/amber/red.

**How to use it.** Set per-category caps in Budget settings; the bars tell you
not just where you are, but where you're heading.

---

## 💬 Top-bar motivational quote ticker

**What it is.** A rotating motivational quote lives in the center of the top bar,
so every screen greets you with a little momentum.

**How it works.**
- A **curated database of ~300 quotes** (`lib/quotes.ts`), each with its author
  where known (anonymous sayings/proverbs show none). Trivial to extend — just
  add `{ t, a }` entries.
- The order is **shuffled once per session**, and a **new quote appears every 2
  minutes** with a soft fade-up-and-unblur animation (`animate-quote-in`,
  reduced-motion aware).
- **Hover to pause** the rotation (so you can finish reading) and reveal the
  **‹ / ›** controls — go **back to the previous** quote or jump to the **next**
  one whenever you like.
- Full text + author show on hover (tooltip); the bar itself truncates so it
  never breaks the header layout. Hidden on small screens to keep mobile clean.

**How to use it.** Nothing to configure — glance up any time. Use ‹ / › to
revisit the last one or skip ahead.

---

## 🎯 Goals — Productivity Overhaul, Phase 4: Notion-style cards, subtasks & a database table

**What it is.** A big usability + polish pass to make Goals feel like Notion:
richer cards with cover images, quick subtasks you can actually create, and a
full editable table/database view.

**How it works.**
- **Cover images.** A goal can have a **cover image** (Notion gallery style). Upload
  one in the goal form; it's compressed client-side to a small base64 image and
  stored inline on the goal doc (no Storage plan needed). It renders as a banner
  across the top of the card and as a thumbnail in the table.
- **Quick subtasks.** Every goal card now has an inline **subtask checklist** —
  type in the "Add subtask" row and hit enter, tick items off, delete on hover.
  For **auto ("From tasks") goals**, subtasks fold straight into the progress %
  (done ÷ total across linked tasks *and* subtasks), and the first open subtask
  becomes the goal's **next action** in Today's Momentum — so a lightweight goal
  broken only into a checklist still moves and still drives the daily list.
- **Better cards.** The card was rebuilt (extracted to its own component):
  cover banner, cleaner title row with the focus ☆, badges, progress, momentum
  chip, the subtask checklist, next-step line, and quick-update — tighter and
  more scannable.
- **Table / database view.** A **Cards ⇄ Table** toggle in the header. The table
  shows every goal with **inline editing** — click the title, status, category,
  progress (for % / count goals) and deadline and edit in place. A toolbar lets
  you **Group by** Category, Year, or Deadline (each group shows a roll-up bar),
  **Filter** by All / Active / At risk / Blocked / Focus, and **Sort** by Title,
  Progress, Momentum, or Deadline. Today's Momentum stays pinned above it.

**How to use it.**
1. Edit a goal → **Upload a cover image**.
2. On any card, use **Add subtask** to break the goal down in seconds.
3. Hit **Table** in the header for a spreadsheet-style view — group by year or
   deadline, filter to what's at risk, and edit fields inline.

> **Deferred.** Goal reminders/notifications (the old Milestone 5) remain out of
> scope for now, by choice.
