# Life OS - Quick Start Guide

**Build Status:** Ready to start  
**Tech:** Next.js 14 + TypeScript + Tailwind + shadcn/ui + Supabase + Vercel  
**Timeline:** 4 weeks (5 milestones, ~10-15 hours/week)  
**Cost:** Free (Vercel + Supabase free tier)  

---

## Step 1: Prepare (15 minutes)

### Create Accounts
1. **Supabase** → supabase.com (sign up with GitHub)
2. **Vercel** → vercel.com (sign up with GitHub)

### Create Supabase Project
1. New project → pick any region
2. Copy `SUPABASE_URL` and `SUPABASE_ANON_KEY`
3. Go to SQL editor
4. Run the SQL from `MILESTONE_1_PROMPT.md` to create tables

### Create Next.js Project (Locally)
```bash
npx create-next-app@latest life-os --typescript --tailwind --eslint

# Choose:
# - TypeScript: Yes
# - Tailwind: Yes
# - App Router: Yes
# - ESLint: Yes
# - shadcn/ui: Yes (when prompted)

cd life-os
npm install
```

### Install Dependencies
```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install @tanstack/react-query
npm install lucide-react
npm install next-themes  # for dark mode
```

### Create .env.local
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/vicuvi1/life-os.git
git push -u origin main
```

---

## Step 2: Open in Claude Code

### Copy Milestone 1 Prompt
Open `MILESTONE_1_PROMPT.md` and copy the **entire content**.

### Paste into Claude Code
1. Open Claude Code Pro
2. Create new project → select `/home/claude/life-os` folder
3. In Claude chat, paste the Milestone 1 prompt
4. Say: *"Build this following the specification. Let me know when done."*

### Claude Code will:
- Create folder structure
- Setup authentication
- Create database service files
- Build login/signup pages
- Setup theme system
- Create dashboard layout

**⏱️ Expected time: 30-45 minutes**

---

## Step 3: Run Locally

```bash
cd life-os
npm run dev
```

Visit `http://localhost:3000`

You should see:
- Login page (if not authenticated)
- Signup works
- Dark theme by default
- Theme toggle in top-right

**Test:**
1. Sign up with test email
2. Refresh page → should stay logged in
3. Go to settings → click logout
4. Theme toggle works

---

## Step 4: Deploy to Vercel (Optional now, required later)

```bash
# Push latest code to GitHub
git add .
git commit -m "Complete Milestone 1"
git push

# Go to Vercel.com → New Project → Import from GitHub
# Select life-os repo
# Add environment variables:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
# Deploy
```

Your app is now live at `your-username-life-os.vercel.app`

---

## Step 5: Start Milestone 2

Once Milestone 1 is complete:

1. Copy `MILESTONE_2_PROMPT.md`
2. Paste into Claude Code chat
3. Say: *"Build Milestone 2: Goals + Projects + Tasks CRUD"*
4. Review the code
5. Test locally
6. Push to GitHub
7. Vercel auto-deploys

**Repeat for Milestones 3, 4, 5.**

---

## Troubleshooting

### Supabase Connection Issues
- Check `.env.local` has correct URL and key
- Verify Supabase project is active
- In Supabase dashboard → SQL → check tables exist

### Authentication Not Working
- Confirm email/password table exists in Supabase Auth
- Check browser console for errors
- Clear cookies and try again

### Styling Issues
- Restart dev server: `npm run dev`
- Check Tailwind config has correct content paths
- shadcn/ui components should work out of the box

### Deploy Fails
- Add env vars to Vercel project settings
- Check GitHub repo is public
- Verify all dependencies in package.json

---

## Timeline

**Week 1 (Milestone 1):** Auth + Dashboard + Theme  
**Week 2 (Milestone 2):** Goals + Projects + Tasks  
**Week 3 (Milestone 3):** Habits + Daily Planner ← **Start using daily**  
**Week 4 (Milestone 4):** Calendar + Reviews  
**Ongoing (Milestone 5):** Analytics + AI + Polish  

---

## What You'll Have

After Week 3, you have a **fully functional Life OS** that:
- Shows 3 active goals
- Breaks them into projects & tasks
- Tracks daily habits with streaks
- Auto-calculates progress
- Displays everything on a clean morning dashboard

**This is when you start using it every day.**

---

## Git Workflow

After each milestone:

```bash
git add .
git commit -m "Complete Milestone X: [feature name]"
git push
```

Vercel will auto-deploy. Your app updates live.

---

## When You're Done

You'll have:
- ✅ A polished, production-ready app
- ✅ A GitHub repo (portfolio-worthy)
- ✅ A personal tool you use every day
- ✅ Experience with modern full-stack development
- ✅ Something to show employers

---

## Before You Start

Ensure:
- [ ] Node.js installed (v18+)
- [ ] GitHub account
- [ ] Supabase account created
- [ ] Vercel account created
- [ ] Claude Code Pro active
- [ ] Time to build (10-15 hours over 4 weeks)

---

## Optional Enhancements (After MVP)

- Mobile app (React Native)
- Google Calendar integration
- Notifications
- Export to PDF
- Share goals (if building SaaS)
- Integration with Spotify, GitHub, etc.

---

## Ready?

1. ✅ Complete Step 1 (Prepare)
2. ✅ Run locally
3. ✅ **Start Milestone 1 with Claude Code**

**Let's build your Life OS. 🚀**

Questions? Ask Claude.

---

## One More Thing

**Use this system daily starting Week 3.**

Track:
- Which 3 goals you're focusing on
- Daily tasks
- Habit streaks
- Weekly reviews

**This isn't just a coding project—it's your operating system for life.**

Make it count.
