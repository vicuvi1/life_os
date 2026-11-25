/** Map Firebase Auth error codes to friendly, user-facing messages. */
export function authErrorMessage(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again in a moment.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/unauthorized-domain":
      return "This web address isn't authorized for sign-in yet. Add it in Firebase Console → Authentication → Settings → Authorized domains.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in is turned off for this Firebase project. Enable it in Firebase Console → Authentication → Sign-in method.";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "The Firebase API key for this deployment is missing or invalid. Check the NEXT_PUBLIC_FIREBASE_* environment variables.";
    default:
      if (code.includes("requests-from-referer"))
        return "The Firebase API key doesn't allow this web address. Add it under the key's website restrictions in Google Cloud Console → Credentials.";
      // Show the code so an unexpected failure can be diagnosed instead of guessed at.
      return code
        ? `Something went wrong (${code}). Please try again.`
        : "Something went wrong. Please try again.";
  }
}
