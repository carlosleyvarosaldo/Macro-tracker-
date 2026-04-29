"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

export default function DraftsPage() {
  const router = useRouter();
  const { estimates, loadEstimates, setActiveEstimate, activeEstimateId } = useAppStore();

  useEffect(() => {
    loadEstimates();
  }, [loadEstimates]);

  const handleSelect = (id: string) => {
    setActiveEstimate(id);
    router.push("/trees");
  };

  return (
    <div className="px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">Drafts</h1>

      {estimates.length === 0 ? (
        <p className="text-gray-500">No estimates yet. Create one from the Camera tab.</p>
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
  );
}
