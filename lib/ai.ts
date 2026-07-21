// The single AI-provider abstraction every agent call goes through.
// Both providers are called directly from the browser with the user's own key
// (stored in their owner-scoped prefs doc): Anthropic supports CORS via the
// `anthropic-dangerous-direct-browser-access` header; Gemini's REST API is
// CORS-enabled natively. Adding a provider later = one more branch here.

import type { AIProviderType, ChatMessage } from "@/lib/types";

export const PROVIDER_META: Record<AIProviderType, { label: string; defaultModel: string; keyHint: string; keyUrl: string }> = {
  anthropic: {
    label: "Anthropic (Claude)",
    defaultModel: "claude-sonnet-5",
    keyHint: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  gemini: {
    label: "Google Gemini",
    defaultModel: "gemini-2.0-flash",
    keyHint: "AIza…",
    keyUrl: "https://aistudio.google.com/apikey",
  },
};

export interface AgentCall {
  provider: AIProviderType;
  model: string;
  apiKey: string;
  systemPrompt: string;
  /** Prior turns, oldest first (already capped by the caller). */
  history: ChatMessage[];
  userMessage: string;
}

export interface AgentReply {
  ok: boolean;
  text?: string;
  error?: string;
}

export async function callAgentModel(call: AgentCall): Promise<AgentReply> {
  try {
    if (call.provider === "anthropic") return await callAnthropic(call);
    if (call.provider === "gemini") return await callGemini(call);
    return { ok: false, error: `Unknown provider: ${call.provider}` };
  } catch {
    return { ok: false, error: "Network error — couldn't reach the AI provider." };
  }
}

async function callAnthropic(call: AgentCall): Promise<AgentReply> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": call.apiKey.trim(),
      "anthropic-version": "2023-06-01",
      // Anthropic requires this opt-in header for direct browser calls.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: call.model,
      max_tokens: 1024,
      system: call.systemPrompt,
      messages: [
        ...call.history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: call.userMessage },
      ],
    }),
  });
  const j = await r.json();
  if (!r.ok) return { ok: false, error: j?.error?.message || `Anthropic error (${r.status})` };
  const text = Array.isArray(j.content) ? j.content.map((c: { text?: string }) => c.text ?? "").join("\n").trim() : "";
  return text ? { ok: true, text } : { ok: false, error: "Empty response from Claude." };
}

// ---------------------------------------------------------------------------
// Vision — meal-photo recognition (same browser-side, user-key model as chat)
// ---------------------------------------------------------------------------
export interface MealScan {
  name: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface MealScanResult {
  ok: boolean;
  meal?: MealScan;
  error?: string;
}

const SCAN_PROMPT =
  "You are a nutrition assistant. Identify the food/meal in the photo and estimate its nutrition for the whole visible portion. " +
  'Respond with ONLY a JSON object, no markdown, no prose: {"name": string, "calories": number, "protein": number, "carbs": number, "fat": number}. ' +
  "calories in kcal; protein/carbs/fat in grams; round to whole numbers. " +
  'If there is no recognizable food, respond {"error": "no food detected"}.';

/** data:image/...;base64,XXXX → { mediaType, base64 } */
function splitDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  return m ? { mediaType: m[1], base64: m[2] } : null;
}

function parseScan(text: string): MealScanResult {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, error: "Couldn't read the AI response." };
  try {
    const j = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    if (typeof j.error === "string") return { ok: false, error: j.error };
    const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? Math.max(0, Math.round(v)) : null);
    const name = typeof j.name === "string" && j.name.trim() ? j.name.trim() : "Scanned meal";
    return { ok: true, meal: { name, calories: num(j.calories), protein: num(j.protein), carbs: num(j.carbs), fat: num(j.fat) } };
  } catch {
    return { ok: false, error: "Couldn't parse the AI response." };
  }
}

export async function analyzeMealPhoto(opts: {
  provider: AIProviderType;
  model: string;
  apiKey: string;
  imageDataUrl: string;
}): Promise<MealScanResult> {
  const img = splitDataUrl(opts.imageDataUrl);
  if (!img) return { ok: false, error: "Unsupported image format." };
  try {
    if (opts.provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": opts.apiKey.trim(),
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } },
                { type: "text", text: SCAN_PROMPT },
              ],
            },
          ],
        }),
      });
      const j = await r.json();
      if (!r.ok) return { ok: false, error: j?.error?.message || `Anthropic error (${r.status})` };
      const text = Array.isArray(j.content) ? j.content.map((c: { text?: string }) => c.text ?? "").join("\n") : "";
      return parseScan(text);
    }
    if (opts.provider === "gemini") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(opts.apiKey.trim())}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { inline_data: { mime_type: img.mediaType, data: img.base64 } },
                { text: SCAN_PROMPT },
              ],
            },
          ],
        }),
      });
      const j = await r.json();
      if (!r.ok) return { ok: false, error: j?.error?.message || `Gemini error (${r.status})` };
      const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("\n");
      return parseScan(text);
    }
    return { ok: false, error: `Unknown provider: ${opts.provider}` };
  } catch {
    return { ok: false, error: "Network error — couldn't reach the AI provider." };
  }
}

async function callGemini(call: AgentCall): Promise<AgentReply> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(call.model)}:generateContent?key=${encodeURIComponent(call.apiKey.trim())}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: call.systemPrompt }] },
      contents: [
        ...call.history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        { role: "user", parts: [{ text: call.userMessage }] },
      ],
    }),
  });
  const j = await r.json();
  if (!r.ok) return { ok: false, error: j?.error?.message || `Gemini error (${r.status})` };
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("\n").trim();
  return text ? { ok: true, text } : { ok: false, error: "Empty response from Gemini." };
}
