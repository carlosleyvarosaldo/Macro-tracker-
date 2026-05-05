"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Estimate } from "@/types";

type Props = {
  onSelectDraft?: () => void;
};

function estimateDisplayName(estimate: Estimate): string {
  if (estimate.name?.trim()) return estimate.name;
  return `Estimate · ${new Date(estimate.createdAt).toLocaleDateString()}`;
}

export default function DraftsView({ onSelectDraft }: Props) {
  const router = useRouter();
  const {
    estimates,
    loadEstimates,
    setActiveEstimate,
    activeEstimateId,
    deleteEstimate,
    currentUser,
    signOut,
  } = useAppStore();
  const [signOutConfirm, setSignOutConfirm] = useState(false);

  useEffect(() => {
    loadEstimates();
  }, [loadEstimates]);

  const handleSelect = async (id: string) => {
    setActiveEstimate(id);
    await useAppStore.getState().loadTreesForActiveEstimate();
    if (onSelectDraft) onSelectDraft();
    else router.push("/");
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    const ok = window.confirm(
      `Delete "${name}"?\n\nThis removes the estimate and all its trees. This cannot be undone.`
    );
    if (!ok) return;
    await deleteEstimate(id);
  };

  const handleSignOut = () => {
    if (signOutConfirm) {
      signOut();
    } else {
      setSignOutConfirm(true);
      setTimeout(() => setSignOutConfirm(false), 3000);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="px-4 py-6 pb-20">
        {/* Account header */}
        {currentUser && (
          <div className="mb-6 rounded-xl bg-white border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {currentUser.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">Signed in as</p>
              <p className="text-sm font-medium text-gray-900 truncate">
                {currentUser.email}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                signOutConfirm
                  ? "bg-red-600 text-white"
                  : "text-gray-600 active:bg-gray-100"
              }`}
            >
              {signOutConfirm ? "Tap to confirm" : "Sign out"}
            </button>
          </div>
        )}

        <h1 className="text-xl font-semibold mb-4">Drafts</h1>

        {estimates.length === 0 ? (
          <p className="text-gray-500">
            No estimates yet. Swipe to Camera to start one.
          </p>
        ) : (
          <ul className="space-y-2">
            {estimates.map((estimate) => {
              const isActive = estimate.id === activeEstimateId;
              const displayName = estimateDisplayName(estimate);
              return (
                <li
                  key={estimate.id}
                  className={`relative rounded-lg border ${
                    isActive
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <button
                    onClick={() => handleSelect(estimate.id)}
                    className="w-full text-left p-3 pr-12"
                  >
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(estimate.createdAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 uppercase tracking-wide">
                      {estimate.status}
                    </p>
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, estimate.id, displayName)}
                    aria-label="Delete estimate"
                    className="absolute top-1/2 right-2 -translate-y-1/2 w-9 h-9 rounded-full text-gray-400 active:bg-gray-100 active:text-red-600 flex items-center justify-center"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}