"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import {
  generateFullEstimateWriteUp,
  resolveEstimateWriteUp,
} from "@/lib/writeup";

export default function WriteUpView() {
  const {
    activeEstimateId,
    estimates,
    activeTrees,
    loadTreesForActiveEstimate,
    updateEstimate,
  } = useAppStore();

  const [draft, setDraft] = useState<string>("");
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const activeEstimate = useMemo(
    () => estimates.find((e) => e.id === activeEstimateId),
    [estimates, activeEstimateId]
  );

  // Load trees whenever the active estimate changes
  useEffect(() => {
    loadTreesForActiveEstimate();
  }, [activeEstimateId, loadTreesForActiveEstimate]);

  // Initialize the textarea with override (if any) or generated text
  useEffect(() => {
    setDraft(resolveEstimateWriteUp(activeEstimate, activeTrees));
  }, [activeEstimate, activeTrees]);

  // Auto-clear the toast
  useEffect(() => {
    if (!savedToast) return;
    const t = setTimeout(() => setSavedToast(null), 2500);
    return () => clearTimeout(t);
  }, [savedToast]);

  const generated = useMemo(
    () => generateFullEstimateWriteUp(activeTrees),
    [activeTrees]
  );

  const isOverride = !!activeEstimate?.writeUp?.trim();
  const isModified = draft !== resolveEstimateWriteUp(activeEstimate, activeTrees);

  const handleSave = async () => {
    if (!activeEstimateId) return;
    await updateEstimate(activeEstimateId, { writeUp: draft });
    setSavedToast("Saved");
  };

  const handleResetToAuto = async () => {
    if (!activeEstimateId) return;
    // Clear the override and refresh the textarea from generation
    await updateEstimate(activeEstimateId, { writeUp: undefined });
    setDraft(generated);
    setSavedToast("Reset to auto-generated");
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="px-4 py-6 pb-24">
        <h1 className="text-xl font-semibold mb-4">Write-Up</h1>

        {!activeEstimateId && (
          <p className="text-gray-500 text-sm">
            No active estimate. Swipe to Camera to start one.
          </p>
        )}

        {activeEstimateId && activeTrees.length === 0 && (
          <p className="text-gray-500">
            No trees in this estimate yet. Add some trees first.
          </p>
        )}

        {activeEstimateId && activeTrees.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">
                {isOverride
                  ? "Edited (custom write-up)"
                  : "Auto-generated from scope and notes"}
              </p>
              {isOverride && (
                <button
                  onClick={handleResetToAuto}
                  className="text-xs text-emerald-700 font-medium active:text-emerald-800"
                >
                  Reset to auto
                </button>
              )}
            </div>

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={20}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm leading-relaxed bg-white resize-none font-mono"
              placeholder="Write-up will appear here..."
            />

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleSave}
                disabled={!isModified}
                className="flex-1 rounded-lg bg-emerald-600 py-3 text-white text-sm font-semibold active:bg-emerald-700 disabled:bg-gray-300"
              >
                Save changes
              </button>
            </div>

            <p className="mt-3 text-xs text-gray-500 leading-relaxed">
              The PDF export will use this write-up. Editing here doesn&apos;t
              change scope or notes on individual trees.
            </p>
          </>
        )}

        {savedToast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 max-w-[90%] rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg z-20">
            {savedToast}
          </div>
        )}
      </div>
    </div>
  );
}