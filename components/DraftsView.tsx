"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

type Props = {
  /** Called when a draft is selected — parent should swipe to Trees view. */
  onSelectDraft?: () => void;
};

export default function DraftsView({ onSelectDraft }: Props) {
  const router = useRouter();
  const { estimates, loadEstimates, setActiveEstimate, activeEstimateId } =
    useAppStore();

  useEffect(() => {
    loadEstimates();
  }, [loadEstimates]);

  const handleSelect = async (id: string) => {
    setActiveEstimate(id);
    // Force the trees to load before swiping over
    await useAppStore.getState().loadTreesForActiveEstimate();
    if (onSelectDraft) onSelectDraft();
    else router.push("/");
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="px-4 py-6 pb-20">
        <h1 className="text-xl font-semibold mb-4">Drafts</h1>
        {estimates.length === 0 ? (
          <p className="text-gray-500">
            No estimates yet. Swipe to Camera to start one.
          </p>
        ) : (
          <ul className="space-y-2">
            {estimates.map((estimate) => {
              const isActive = estimate.id === activeEstimateId;
              return (
                <li key={estimate.id}>
                  <button
                    onClick={() => handleSelect(estimate.id)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      isActive
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium font-mono">
                          {estimate.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(estimate.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 uppercase">
                        {estimate.status}
                      </span>
                    </div>
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