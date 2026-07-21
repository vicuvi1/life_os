// Telegram Bot API helpers. The Bot API is CORS-enabled, so these run directly
// from the browser — the user's bot token lives in their own (owner-scoped)
// prefs doc and never leaves their control.

const API = "https://api.telegram.org";

export interface TgResult {
  ok: boolean;
  error?: string;
}

/** Validate a bot token and return the bot's @username. */
export async function tgGetMe(token: string): Promise<{ ok: boolean; username?: string; error?: string }> {
  try {
    const r = await fetch(`${API}/bot${token.trim()}/getMe`);
    const j = await r.json();
    if (j.ok) return { ok: true, username: j.result?.username };
    return { ok: false, error: j.description || "Invalid token" };
  } catch {
    return { ok: false, error: "Couldn't reach Telegram. Check your connection." };
  }
}

/**
 * Find the chat id to send to by reading recent updates — the user must have
 * sent their bot a message first (that's how Telegram exposes the chat id).
 */
export async function tgDetectChatId(
  token: string
): Promise<{ ok: boolean; chatId?: string; name?: string; error?: string }> {
  try {
    const r = await fetch(`${API}/bot${token.trim()}/getUpdates`);
    const j = await r.json();
    if (!j.ok) return { ok: false, error: j.description || "Couldn't read updates" };
    const updates: unknown[] = Array.isArray(j.result) ? j.result : [];
    for (let i = updates.length - 1; i >= 0; i--) {
      const u = updates[i] as { message?: { chat?: { id?: number; first_name?: string; title?: string } } };
      const chat = u.message?.chat;
      if (chat?.id != null) return { ok: true, chatId: String(chat.id), name: chat.first_name || chat.title };
    }
    return { ok: false, error: "No message found yet — send your bot a message, then tap Detect again." };
  } catch {
    return { ok: false, error: "Couldn't reach Telegram. Check your connection." };
  }
}

/** Send an HTML message to a chat. Best-effort; returns ok/error. */
export async function tgSend(token: string, chatId: string, text: string): Promise<TgResult> {
  try {
    const r = await fetch(`${API}/bot${token.trim()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const j = await r.json();
    return j.ok ? { ok: true } : { ok: false, error: j.description || "Send failed" };
  } catch {
    return { ok: false, error: "Couldn't reach Telegram. Check your connection." };
  }
}
