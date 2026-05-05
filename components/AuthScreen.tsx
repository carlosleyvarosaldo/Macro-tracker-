"use client";

import { useState } from "react";
import { signIn, signUp } from "@/lib/auth";
import { useAppStore } from "@/lib/store";

type Mode = "signin" | "signup";

export default function AuthScreen() {
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "signin"
          ? await signIn(email, password)
          : await signUp(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Trigger full bootstrap so estimates load
      await useAppStore.getState().bootstrapAuth();
      setCurrentUser(result.user);
      // Reload estimates for this user
      await useAppStore.getState().loadEstimates();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center px-6">
      <div className="max-w-sm w-full mx-auto">
        <h1 className="text-3xl font-semibold text-gray-900 mb-1">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          {mode === "signin"
            ? "Welcome back. Enter your details."
            : "Just an email and password — stays on this device."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3.5 text-base bg-white"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3.5 text-base bg-white"
              placeholder="At least 6 characters"
              required
              minLength={6}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-emerald-600 py-4 text-white font-semibold text-base active:bg-emerald-700 disabled:opacity-60"
          >
            {busy
              ? mode === "signin"
                ? "Signing in..."
                : "Creating..."
              : mode === "signin"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => {
              setError(null);
              setMode(mode === "signin" ? "signup" : "signin");
            }}
            className="text-sm text-emerald-700 font-medium"
          >
            {mode === "signin"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-8 leading-relaxed">
          Your account stays on this device. Sign up on each device you use.
        </p>
      </div>
    </div>
  );
}