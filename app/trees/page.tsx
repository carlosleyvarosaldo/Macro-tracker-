"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { getScopeLabel } from "@/lib/scope";

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
          {activeTrees.map((tree) => {
            const scope = tree.scopeItems ?? [];
            return (
              <li key={tree.id}>
                <Link href={`/trees/${tree.id}`} className="flex gap-3 rounded-lg bg-white border border-gray-200 p-3 active:bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={tree.image} alt="Tree" className="h-16 w-16 rounded-md object-cover bg-gray-100 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">
                      {new Date(tree.createdAt).toLocaleString()}
                    </p>
                    {scope.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No scope selected</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {scope.map((id) => (
                          <span key={id} className="inline-block rounded bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 border border-emerald-200">
                            {getScopeLabel(id)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
