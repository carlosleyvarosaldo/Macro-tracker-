"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { getEstimateById } from "@/lib/db";
import { Estimate } from "@/types";

export default function TreesPage() {
  const { activeEstimateId } = useAppStore();
  const [estimate, setEstimate] = useState<Estimate | null>(null);

  useEffect(() => {
    if (!activeEstimateId) {
      setEstimate(null);
      return;
    }
    getEstimateById(activeEstimateId).then((e) => setEstimate(e ?? null));
  }, [activeEstimateId]);

  return (
    <div className="px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">Trees</h1>

      {!activeEstimateId && (
        <p className="text-gray-500 text-sm">
          No active estimate. Start one from the Camera tab.
        </p>
      )}

      {activeEstimateId && estimate && estimate.trees.length === 0 && (
        <p className="text-gray-500">No trees yet</p>
      )}

      {estimate && estimate.trees.length > 0 && (
        <ul className="space-y-2">
          {estimate.trees.map((tree) => (
            <li key={tree.id} className="rounded-lg bg-white border border-gray-200 p-3">
              <p className="text-sm font-medium">Tree {tree.id.slice(0, 6)}</p>
              <p className="text-xs text-gray-500">${tree.price}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
