// Life OS is a single-owner app: the lock screen asks only for a password.
// Firebase Auth still needs an email to identify the account that owns the
// data, so the app supplies this fixed one behind the scenes. It is never shown
// and never receives mail. Set NEXT_PUBLIC_OWNER_EMAIL to unlock a different
// (e.g. pre-existing) account instead.
export const OWNER_EMAIL: string =
  process.env.NEXT_PUBLIC_OWNER_EMAIL?.trim() || "owner@lifeos.example.com";
