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
