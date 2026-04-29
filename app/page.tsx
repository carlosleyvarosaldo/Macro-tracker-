"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

export default function CameraPage() {
  const { createEstimate, loadEstimates, activeEstimateId } = useAppStore();

  useEffect(() => {
    loadEstimates();
  }, [loadEstimates]);

  const handleNewEstimate = async () => {
    await createEstimate();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 pb-16">
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-lg">Camera coming soon</p>
      </div>

      <div className="w-full pb-8 space-y-3">
        {activeEstimateId && (
          <p className="text-center text-xs text-gray-500">
            Active estimate: {activeEstimateId.slice(0, 8)}
          </p>
        )}
        <button
          onClick={handleNewEstimate}
          className="w-full rounded-xl bg-emerald-600 py-4 text-white font-semibold active:bg-emerald-700"
        >
          New Estimate
        </button>
      </div>
    </div>
  );
}
