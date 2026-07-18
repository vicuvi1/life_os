# Life OS - Master Specification & Architecture

**Built for:** Victor (19, Moldova)  
**Primary Use Case:** Morning dashboard + goal execution + habit tracking  
**Tech Stack:** Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui + Supabase + Vercel  
**Target Users:** Personal use (extensible to SaaS later)

---

## 1. Core Problem

Victor has 18-20 disorganized goals mixed in Notion with no clear daily execution path. He wakes up at 6-7am but doesn't know what to focus on. He needs a system that:

1. **Shows him 3 active goals only** (not 20)
2. **Breaks goals into projects, then daily tasks**
3. **Tracks habits independently** (skincare, Spanish, exercise, vitamins, etc.)
4. **Displays progress visually** (progress bars, streaks, XP)
5. **Motivates him with momentum** (daily habit streaks, weekly reviews)
6. **Works fast** (loads in <1 second on waking at 6-7am)

---

## 2. Database Schema (Supabase)

```
users
├── id (UUID)
├── email
├── created_at
├── theme (light/dark)

goals
├── id (UUID)
├── user_id (FK)
├── title
├── description
├── status (active, paused, completed, archived)
├── priority (high, medium, low)
├── progress (0-100)
├── deadline (date)
├── quarter (Q3, Q4, Q1, etc.)
├── category (education, career, health, financial, personal)
├── created_at

projects
├── id (UUID)
├── goal_id (FK)
├── title
├── description
├── status (not_started, in_progress, completed)
├── order (for sorting)
├── created_at

tasks
├── id (UUID)
├── project_id (FK)
├── goal_id (FK)
├── title
├── description
├── status (todo, in_progress, done)
├── priority (high, medium, low)
├── due_date (date)
├── completed_at (timestamp)
├── order (for sorting)
├── created_at

habits
├── id (UUID)
├── user_id (FK)
├── title
├── description
├── frequency (daily, weekly)
├── category (morning, evening, exercise, learning, health)
├── color (for UI)
├── streak (current)
├── best_streak
├── last_completed (date)
├── created_at

habit_logs
├── id (UUID)
├── habit_id (FK)
├── completed_date (date)
├── completed_at (timestamp)

weekly_reviews
├── id (UUID)
├── user_id (FK)
├── week_start (date)
├── accomplishments (text)
├── blockers (text)
├── next_week_focus (text)
├── score (0-100)
├── created_at
```

---

## 3. User Interface Structure

```
Life OS Dashboard
├── 🎯 Active Goals Section (Top 3)
│   ├── Goal card with progress bar
│   ├── Current project name
│   ├── Tasks completed today / total
│   └── Time remaining (days)
│
├── 📋 Today's Focus
│   ├── Morning tasks (3-5 quick wins)
│   ├── Active project tasks
│   └── Evening review
│
├── 🔥 Habit Tracker
│   ├── Daily habits (checkboxes)
│   ├── Current streaks
│   └── Weekly summary
│
├── 📊 Dashboard Stats
│   ├── Overall productivity score
│   ├── Habit completion rate
│   ├── Goal progress average
│   └── This week's wins
│
└── 🎯 Sidebar Navigation
    ├── Dashboard
    ├── Goals
    ├── Projects
    ├── Tasks
    ├── Habits
    ├── Weekly Review
    └── Settings
```

---

## 4. Key Features by Priority

### P0 (Essential - Milestone 1-2)
- ✅ User authentication (email/password, optional Google)
- ✅ Dark mode (default) + Light mode toggle
- ✅ Morning dashboard (loads instantly)
- ✅ Display 3 active goals with progress
- ✅ Create/edit/delete goals
- ✅ Create projects for each goal
- ✅ Create daily tasks
- ✅ Mark tasks complete → auto-update goal progress

### P1 (Important - Milestone 3)
- ✅ Habit tracking with daily checkboxes
- ✅ Habit streaks (current + best)
- ✅ Habit categories (morning, evening, exercise, learning)
- ✅ Today's view (filtered tasks + habits)
- ✅ Quick-add task from dashboard

### P2 (Nice to have - Milestone 4-5)
- ✅ Calendar view of tasks
- ✅ Weekly review template
- ✅ Progress charts and analytics
- ✅ Quarterly planning view
- ✅ Habit heatmap (GitHub-style activity)
- ✅ AI-powered weekly review assistant

### P3 (Future)
- ✅ Mobile app (React Native)
- ✅ Notifications/reminders
- ✅ Integration with Google Calendar
- ✅ Export to PDF
- ✅ Sharing (if you build the SaaS version)

---

## 5. Victor's Specific Setup

### Active Goals (Q3 2026)
1. **Reach C1 English** (Deadline: Dec 2026)
   - Projects: Grammar book, vocabulary, speaking practice, mock exams
   
2. **Get First Cybersecurity Job** (Deadline: Dec 2026)
   - Projects: Finish CCNA, learn Linux, learn Python, build portfolio, practice interviews
   
3. **Improve Health & Habits** (Ongoing)
   - Projects: Consistent workout, skincare routine, hair care, vitamins

### Daily Habits (Non-negotiable)
- Morning: Vitamins, skincare, face exercises, stretching
- Learning: Spanish (2h), Linux/Cisco study (2h)
- Exercise: Push-ups, workout
- Evening: Water intake, no sugar, mental math

### Morning Dashboard (What Victor sees at 6am)
```
🌅 Good morning, Victor!

🎯 Today's Focus
━━━━━━━━━━━━━━━━━━
✓ Reach C1 English (54%)
  Current: Complete Grammar Book
  Today: Lesson 41, 42, Speaking 30min

🔥 Your Streaks
━━━━━━━━━━━━━━━━━━
🟥 34-day Spanish
🟥 12-day Workout
🟥 8-day No Sugar
✅ 🟩 Today's habits: 3/8

📋 Quick Wins Today
━━━━━━━━━━━━━━━━━━
□ Morning routine (vitamins, skincare)
□ Spanish lesson
□ Workout
□ Cisco study 1h
□ Grammar book 30min

🎯 Tomorrow's prep
Review yesterday's blockers
```

---

## 6. Design Principles

- **Minimalist & Fast** — No distractions, loads instantly
- **Dark mode default** — Better for 6am wake-ups
- **Visual progress** — Progress bars, streaks, charts
- **Mobile-responsive** — Works on phone too
- **Motivating** — Shows wins, not just lists
- **Actionable** — Clear "what to do now"

---

## 7. Development Roadmap

**Milestone 1 (Week 1):**
- Auth setup (Supabase)
- Database schema
- Dashboard layout
- Theme toggle

**Milestone 2 (Week 2):**
- Goals CRUD
- Projects CRUD
- Tasks CRUD
- Progress calculations

**Milestone 3 (Week 3):**
- Habit tracking
- Daily dashboard
- Quick task add

**Milestone 4 (Week 4):**
- Calendar view
- Weekly reviews
- Analytics charts

**Milestone 5 (Ongoing):**
- AI features
- Optimizations
- Polish

---

## 8. Success Criteria

✅ Victor opens the app at 6am and immediately knows his 3 focus areas  
✅ He can add a task in <5 seconds  
✅ Habit streaks are visible and motivating  
✅ Goal progress updates automatically as tasks complete  
✅ Weekly reviews help him stay accountable  
✅ The app becomes his single source of truth for goals, projects, tasks, habits  

---

## 9. Deployment

- **Frontend:** Vercel
- **Database:** Supabase (free tier supports personal use)
- **Domain:** Optional (can use vercel.app subdomain)
- **Cost:** Free

---

## 10. Portfolio Value

This project demonstrates:
- Full-stack architecture (Next.js + Supabase)
- Database design & relational modeling
- Authentication & security
- Real-time UI updates
- Responsive design
- Git workflow & deployment
- Problem-solving (organizing complex data)

**This is worth showing in interviews.**
