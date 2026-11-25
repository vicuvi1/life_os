// Life OS is a single-owner app: the lock screen asks only for a PIN.
// Firebase Auth still needs an email to identify the account that owns the
// data, so the app supplies this fixed one behind the scenes. It is never shown
// and never receives mail. Set NEXT_PUBLIC_OWNER_EMAIL to unlock a different
// (e.g. pre-existing) account instead.
export const OWNER_EMAIL: string =
  process.env.NEXT_PUBLIC_OWNER_EMAIL?.trim() || "owner@lifeos.example.com";

/**
 * Firebase requires passwords of 6+ characters, so a short PIN is expanded into
 * the account's password. The prefix adds no secrecy — the PIN is the secret.
 */
export function pinToPassword(pin: string): string {
  return `lifeos-pin:${pin.trim()}`;
}
