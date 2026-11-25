"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Logo } from "@/components/logo";
import { authErrorMessage } from "@/lib/firebase/errors";
import { OWNER_EMAIL, pinToPassword } from "@/lib/owner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function errorCode(err: unknown): string {
  return typeof err === "object" && err !== null && "code" in err
    ? String((err as { code: unknown }).code)
    : "";
}

/**
 * PIN-only lock screen. "login" unlocks the app; "setup" is the one-time
 * step that sets the PIN the first time the app is opened.
 */
export function AuthForm({ mode }: { mode: "login" | "setup" }) {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const isLogin = mode === "login";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isLogin) {
      if (!/^\d{4,}$/.test(password)) {
        setError("Your PIN must be at least 4 digits.");
        return;
      }
      if (password !== confirmPassword) {
        setError("The two PINs don't match.");
        return;
      }
    }

    setPending(true);
    try {
      if (isLogin) {
        await signIn(OWNER_EMAIL, pinToPassword(password));
      } else {
        await signUp(OWNER_EMAIL, pinToPassword(password));
      }
      router.replace("/dashboard");
    } catch (err) {
      const code = errorCode(err);
      if (!isLogin && code === "auth/email-already-in-use") {
        setError("A PIN is already set for this app. Go back and unlock with it.");
      } else if (
        isLogin &&
        (code === "auth/invalid-credential" ||
          code === "auth/wrong-password" ||
          code === "auth/user-not-found")
      ) {
        setError("Wrong PIN. If this is your first time here, set a PIN below.");
      } else {
        setError(authErrorMessage(err));
      }
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-2 text-center">
        <Logo size={48} className="mx-auto" />
        <CardTitle className="text-2xl">
          {isLogin ? "Welcome back" : "Set your PIN"}
        </CardTitle>
        <CardDescription>
          {isLogin
            ? "Enter your PIN to open Life OS."
            : "Choose the PIN you'll use to open Life OS. You only do this once."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hidden username so password managers save and fill this login. */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            value="Life OS"
            readOnly
            hidden
          />
          <div className="space-y-2">
            <Label htmlFor="password">PIN</Label>
            <Input
              id="password"
              name="password"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder="••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm PIN</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
              inputMode="numeric"
              pattern="[0-9]*"
                autoComplete="new-password"
                placeholder="••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Please wait…" : isLogin ? "Unlock" : "Set PIN"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isLogin ? "First time here? " : "Already set a PIN? "}
          <Link
            href={isLogin ? "/signup" : "/login"}
            className="font-medium text-primary hover:underline"
          >
            {isLogin ? "Set your PIN" : "Unlock"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
