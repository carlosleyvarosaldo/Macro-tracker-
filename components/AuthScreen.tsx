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
      await useAppStore.getState().bootstrapAuth();
      setCurrentUser(result.user);
      await useAppStore.getState().loadEstimates();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--ios-bg)] flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        <div className="max-w-sm w-full mx-auto">
          {/* Brand mark */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600 mx-auto mb-3 flex items-center justify-center">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22V12" />
                <path d="M12 12 L8 8 a4 4 0 0 1 4-4 a4 4 0 0 1 4 4 L12 12" />
                <path d="M12 12 L6 6 a6 6 0 0 1 6-6" />
                <path d="M12 12 L18 6 a6 6 0 0 0 -6-6" />
              </svg>
            </div>
            <h1 className="text-[28px] font-bold tracking-tight text-gray-900">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-[15px] text-gray-500 mt-1">
              {mode === "signin"
                ? "Sign in to continue"
                : "Stays on this device"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-200/70 overflow-hidden divide-y divide-gray-200/70">
              <div className="px-4 py-3">
                <label className="block text-[12px] font-medium text-gray-500 mb-0.5">
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-[17px] bg-transparent focus:outline-none"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="px-4 py-3">
                <label className="block text-[12px] font-medium text-gray-500 mb-0.5">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-[17px] bg-transparent focus:outline-none"
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <p className="text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3 py-2 text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-emerald-600 py-3.5 text-white font-semibold text-[17px] active:bg-emerald-700 disabled:opacity-60 mt-2 flex items-center justify-center gap-2"
            >
              {busy && <span className="ios-spinner light" />}
              {busy
                ? mode === "signin"
                  ? "Signing in..."
                  : "Creating..."
                : mode === "signin"
                ? "Sign in"
                : "Create account"}
            </button>
          </form>

          <div className="text-center mt-5">
            <button
              onClick={() => {
                setError(null);
                setMode(mode === "signin" ? "signup" : "signin");
              }}
              className="text-[15px] text-emerald-700 font-medium"
            >
              {mode === "signin"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>

      <p className="text-[12px] text-gray-400 text-center px-6 pb-6">
        Your account stays on this device. Sign up on each device you use.
      </p>
    </div>
  );
}