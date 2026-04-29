"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

export default function TreesPage() {
  const { activeEstimateId, activeTrees, loadTreesForActiveEstimate } = useAppStore();

  useEffect(() => {
    loadTreesForActiveEstimate();
  }, [activeEstimateId, loadTreesForActiveEstimate]);

  return (
    <div className="px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">Trees</h1>

      {!activeEstimateId && (
        <p className="text-gray-500 text-sm">
          No active estimate. Start one from the Camera tab.
        </p>
      )}

      {activeEstimateId && activeTrees.length === 0 && (
        <p className="text-gray-500">No trees yet</p>
      )}

      {activeTrees.length > 0 && (
        <ul className="space-y-3">
          {activeTrees.map((tree) => (
            <li
              key={tree.id}
              className="flex items-center gap-3 rounded-lg bg-white border border-gray-200 p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tree.image}
                alt="Tree"
                className="h-16 w-16 rounded-md object-cover bg-gray-100"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Tree {tree.id.slice(0, 6)}</p>
                <p className="text-xs text-gray-500">
                  {new Date(tree.createdAt).toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
