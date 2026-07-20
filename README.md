# Life OS

Your operating system for goals, projects, tasks & habits — a fast, dark-mode-first
morning dashboard that shows you the 3 things that matter today.

Built with **Next.js 14 (App Router) · TypeScript · Tailwind · Firebase**.

> Note: the original spec docs mention Supabase — the project uses **Firebase**
> (Auth + Firestore) instead. Ignore Supabase references in the spec.

---

## Milestone 1 — Foundation ✅ (this build)

- Firebase Auth (email/password), client-side via an `AuthProvider` context
- Client-side route protection (`(app)` and `(auth)` layout guards)
- Dark-mode-first theme system (`next-themes`) with a toggle
- App shell: sidebar navigation + top bar
- Morning dashboard with active goals, habit list, and quick stats (resilient
  empty states until you add data)
- Firestore data model + **Security Rules** (`firestore.rules`), owner-scoped by `userId`

Screens for Goals, Projects, Tasks, Habits, and Weekly Review are stubbed and get
built out in Milestones 2–4 (see `LIFE_OS_SPECIFICATION.md`).

---

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure Firebase

1. Create a project in the [Firebase Console](https://console.firebase.google.com).
2. **Build → Authentication → Sign-in method:** enable **Email/Password**.
3. **Build → Firestore Database:** create a database (production mode).
4. Publish the security rules from `firestore.rules` (via the console or
   `firebase deploy --only firestore:rules`).
5. Copy `.env.example` to `.env.local` and fill in your web config (Project
   settings → General → Your apps → SDK setup):

```bash
cp .env.example .env.local
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll land on the login page,
sign up, and be dropped into your dashboard.

---

## Project structure

```
app/
  (auth)/            login, signup — client-side Firebase Auth + guard
  (app)/             authenticated shell — dashboard + feature pages
  layout.tsx         root layout + theme + auth providers
components/
  ui/                shadcn-style primitives (button, card, input, ...)
  auth-provider      Firebase Auth context (useAuth)
  sidebar, topbar, theme-toggle
lib/
  firebase/          config (app/auth/db), auth errors, Firestore helpers
  types.ts           domain types + collection names
  greeting.ts        dashboard helpers
firestore.rules      Firestore Security Rules (owner-scoped by userId)
```

## Deployment

Deploy to Vercel, add the `NEXT_PUBLIC_FIREBASE_*` env vars in the project
settings, and it auto-deploys on push. Add your Vercel domain to Firebase Auth →
Settings → Authorized domains.
