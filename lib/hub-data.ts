// Cross-module data loader for the Agent Hub — the one place that reads across
// modules. Individual modules stay self-contained; the hub integrates them.

import {
  getWardrobe,
  getExpenses,
  getBudget,
  getSleepLogs,
  getTasks,
  getPrefs,
  getHubDocs,
  type HubDocs,
} from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import type { HubData, HubWeather } from "@/lib/hub";
import type { UserPrefs } from "@/lib/types";

const WEATHER_LAT = 47.01;
const WEATHER_LON = 28.86;

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

export async function fetchHubWeather(): Promise<HubWeather | null> {
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max&forecast_days=2&timezone=auto`
    );
    const j = await r.json();
    const t = j?.current?.temperature_2m;
    const c = j?.current?.weather_code;
    if (typeof t !== "number" || typeof c !== "number") return null;
    const tomorrowCode: number | undefined = j?.daily?.weather_code?.[1];
    const tomorrowMax: number | undefined = j?.daily?.temperature_2m_max?.[1];
    return {
      temp: Math.round(t),
      code: c,
      label: wmoLabel(c),
      rainTomorrow: tomorrowCode != null ? WMO_RAIN.has(tomorrowCode) : false,
      tomorrowMax: typeof tomorrowMax === "number" ? Math.round(tomorrowMax) : null,
    };
  } catch {
    return null;
  }
}

export interface HubLoad {
  data: HubData;
  docs: HubDocs;
  prefs: UserPrefs;
}

/** Load everything the hub needs in parallel (weather is best-effort). */
export async function loadHub(userId: string): Promise<HubLoad> {
  const today = toDateKey(new Date());
  const [wardrobe, expenses, budget, sleep, tasks, prefs, docs, weather] = await Promise.all([
    getWardrobe(userId),
    getExpenses(userId),
    getBudget(userId),
    getSleepLogs(userId),
    getTasks(userId),
    getPrefs(userId),
    getHubDocs(userId),
    fetchHubWeather(),
  ]);
  return {
    data: {
      today,
      items: wardrobe.items,
      outfits: wardrobe.outfits,
      wears: wardrobe.wears,
      expenses,
      budget,
      sleep,
      sleepTarget: prefs.sleepTarget,
      tasks,
      weather,
    },
    docs,
    prefs,
  };
}
