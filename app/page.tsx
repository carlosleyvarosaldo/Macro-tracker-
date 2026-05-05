"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import SwipeShell from "@/components/SwipeShell";
import AuthScreen from "@/components/AuthScreen";

export default function Home() {
  const { currentUser, authChecked, bootstrapAuth } = useAppStore();

  useEffect(() => {
    bootstrapAuth();
  }, [bootstrapAuth]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  return <SwipeShell />;
}