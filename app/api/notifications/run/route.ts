// Background notification sender. Called on a schedule (Vercel Cron, or any
// external scheduler) — evaluates each user's enabled time-based templates
// against the current local time and delivers due ones via Telegram.
//
// SELF-DISABLING: if FIREBASE_SERVICE_ACCOUNT or CRON_SECRET aren't set, it
// no-ops, so shipping this never affects the app until you configure it.
//
// Setup (Vercel → Project → Settings → Environment Variables):
//   CRON_SECRET            = any long random string
//   FIREBASE_SERVICE_ACCOUNT = the full service-account JSON (one line)
// Cron is declared in vercel.json. Timezone defaults to Europe/Chisinau (?tz= to override).

import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { isTemplateDue, resolveBody, EVENT_META } from "@/lib/notifications";
import { buildNotifValues } from "@/lib/notif-values";
import { resolveFirstName } from "@/lib/greeting";
import type { HubData, HubWeather } from "@/lib/hub";
import type { Habit, NotificationTemplate, Session, SleepLog } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WMO_RAIN = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
function wmoLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (WMO_RAIN.has(code)) return "Rain";
  if (code <= 86) return "Snow";
  return "Storm";
}

async function fetchWeather(): Promise<HubWeather | null> {
  try {
    const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=47.01&longitude=28.86&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max&forecast_days=2&timezone=auto");
    const j = await r.json();
    const t = j?.current?.temperature_2m;
    const c = j?.current?.weather_code;
    if (typeof t !== "number" || typeof c !== "number") return null;
    const tc: number | undefined = j?.daily?.weather_code?.[1];
    const tm: number | undefined = j?.daily?.temperature_2m_max?.[1];
    return { temp: Math.round(t), code: c, label: wmoLabel(c), rainTomorrow: tc != null ? WMO_RAIN.has(tc) : false, tomorrowMax: typeof tm === "number" ? Math.round(tm) : null };
  } catch {
    return null;
  }
}

function localNow(tz: string) {
  const now = new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  const nowMin = Number(parts.hour) * 60 + Number(parts.minute);
  const weekday = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[parts.weekday] ?? now.getUTCDay();
  return { dateKey, nowMin, weekday, now };
}

async function tgSend(token: string, chatId: string, text: string): Promise<boolean> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    return (await r.json())?.ok === true;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!secret || !svc) return Response.json({ ok: false, reason: "not_configured" });

  const url = new URL(req.url);
  const authed = req.headers.get("authorization") === `Bearer ${secret}` || url.searchParams.get("key") === secret;
  if (!authed) return new Response("Unauthorized", { status: 401 });

  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(svc) as ServiceAccount) });
  const db = getFirestore();
  const tz = url.searchParams.get("tz") || "Europe/Chisinau";
  const { dateKey, nowMin, weekday, now } = localNow(tz);

  let checked = 0;
  let sent = 0;

  const prefsSnap = await db.collection("prefs").where("telegram.enabled", "==", true).get();
  const weather = await fetchWeather();

  for (const p of prefsSnap.docs) {
    try {
      const uid = (p.get("userId") as string) || p.id;
      const tg = p.get("telegram") as { botToken?: string; chatId?: string } | undefined;
      if (!tg?.botToken || !tg?.chatId) continue;
      const bedtimeTarget = (p.get("bedtimeTarget") as string) ?? null;
      const wakeTarget = (p.get("wakeTarget") as string) ?? null;
      const sleepTarget = (p.get("sleepTarget") as number) ?? 8;

      const decSnap = await db.collection("decisions").where("userId", "==", uid).get();
      const templates = decSnap.docs
        .filter((d) => d.get("docType") === "notiftemplate")
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as unknown as NotificationTemplate);
      const timeBased = templates.filter((t) => t.enabled && !EVENT_META[t.eventType]?.eventDriven);
      if (!timeBased.length) continue;

      const [sleepSnap, habitSnap, sessionSnap] = await Promise.all([
        db.collection("sleepLogs").where("userId", "==", uid).get(),
        db.collection("habits").where("userId", "==", uid).get(),
        db.collection("sessions").where("userId", "==", uid).get(),
      ]);

      const sleep = sleepSnap.docs
        .filter((d) => d.get("docType") !== "meta" && d.get("kind") !== "nap")
        .map((d) => ({ date: d.get("date"), kind: "sleep", hours: d.get("hours") ?? 0, bedtime: d.get("bedtime") ?? null, wakeTime: d.get("wakeTime") ?? null, awakeMinutes: d.get("awakeMinutes") ?? 0, quality: d.get("quality") ?? 0 }))
        .filter((s) => s.hours > 0)
        .sort((a, b) => (a.date < b.date ? 1 : -1)) as unknown as SleepLog[];
      const habits = habitSnap.docs.map((d) => ({ archived: d.get("archived") === true, lastCompleted: d.get("lastCompleted") ?? null, streak: d.get("streak") ?? 0 })) as unknown as Habit[];
      const sessions = sessionSnap.docs.map((d) => ({ date: d.get("date"), startMin: d.get("startMin") ?? 0, title: d.get("title") ?? "", status: d.get("status") ?? "planned" })) as unknown as Session[];

      let name = "there";
      try { const u = await getAuth().getUser(uid); name = resolveFirstName(u.displayName, u.email); } catch { /* auth optional */ }

      const data: HubData = { today: dateKey, items: [], outfits: [], wears: [], expenses: [], budget: null, sleep, sleepTarget, tasks: [], weather };
      const values = buildNotifValues({ data, habits, sessions, name, now });
      const notLoggedToday = !sleep.some((s) => s.date === dateKey);
      const habitsRemaining = habits.some((h) => !h.archived && h.lastCompleted !== dateKey);

      for (const t of timeBased) {
        checked++;
        const firedToday = t.lastFired === dateKey;
        if (!isTemplateDue(t, { bedtimeTarget, wakeTarget, nowMin, weekday, firedToday, notLoggedToday, habitsRemaining })) continue;
        const text = resolveBody(t.body, values);
        const ok = await tgSend(tg.botToken, tg.chatId, text);
        if (ok) sent++;
        await Promise.all([
          db.collection("decisions").add({ userId: uid, docType: "notiflog", eventType: t.eventType, body: text, status: ok ? "delivered" : "failed", createdAt: FieldValue.serverTimestamp() }),
          db.collection("decisions").doc(t.id).update({ lastFired: dateKey }),
        ]);
      }
    } catch {
      // never let one user break the run
    }
  }

  return Response.json({ ok: true, at: `${dateKey} ${Math.floor(nowMin / 60)}:${String(nowMin % 60).padStart(2, "0")} ${tz}`, users: prefsSnap.size, checked, sent });
}
