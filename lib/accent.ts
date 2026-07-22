// User-selectable accent colour. Overrides the theme's --primary / --ring CSS
// variables on the <html> element (an inline style beats the stylesheet in both
// light and dark), so one value re-themes the whole app.

export interface Accent {
  name: string;
  hsl: string; // "H S% L%" (space-separated, hsl() wraps it)
}

export const ACCENTS: Accent[] = [
  { name: "Violet", hsl: "263 85% 66%" },
  { name: "Blue", hsl: "217 91% 60%" },
  { name: "Sky", hsl: "199 89% 52%" },
  { name: "Emerald", hsl: "158 74% 44%" },
  { name: "Amber", hsl: "38 92% 52%" },
  { name: "Orange", hsl: "25 95% 58%" },
  { name: "Rose", hsl: "347 89% 62%" },
  { name: "Pink", hsl: "330 81% 62%" },
];

export const ACCENT_KEY = "lifeos:accent";

export function applyAccent(hsl: string): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--ring", hsl);
}

export function storedAccent(): string | null {
  try {
    return localStorage.getItem(ACCENT_KEY);
  } catch {
    return null;
  }
}

export function setStoredAccent(hsl: string): void {
  try {
    localStorage.setItem(ACCENT_KEY, hsl);
  } catch {
    /* ignore */
  }
  applyAccent(hsl);
}
