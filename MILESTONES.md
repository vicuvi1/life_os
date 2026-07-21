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

**Deferred.**
- **AI Summary block** (an LLM-generated block) — the one Phase-2 block left out;
  the text-level AI rewrite already covers AI wording.
- **Public template marketplace** — out of scope for a single-user app (needs
  multi-user identity + moderation); Export/Import is the realistic "sharing".
- Hands-free **scheduled** delivery for time-based events while the app is
  closed still needs the background sender (Vercel cron) noted earlier; "Send
  now" and the sleep-logged auto-send work today.
