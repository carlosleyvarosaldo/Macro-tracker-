"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { getScopeLabel } from "@/lib/scope";
import { buildKml, downloadKml, hasValidLocation } from "@/lib/kml";
import { ensureAllTreeImagesUploaded } from "@/lib/upload";

function formatLocation(lat: number, lng: number): string {
  if (lat === 0 && lng === 0) return "No location";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function formatDateForFilename(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function TreesPage() {
  const { activeEstimateId, activeTrees, loadTreesForActiveEstimate } = useAppStore();
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadTreesForActiveEstimate();
  }, [activeEstimateId, loadTreesForActiveEstimate]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const exportable = useMemo(
    () => activeTrees.filter(hasValidLocation),
    [activeTrees]
  );

  const handleExport = async () => {
    if (!activeEstimateId || exportable.length === 0 || exporting) return;

    setExporting(true);
    try {
      // 1. Upload any photos that haven't been uploaded yet
      const imageUrls = await ensureAllTreeImagesUploaded(
        exportable,
        (done, total) => {
          setToast(`Uploading photos ${done}/${total}...`);
        }
      );

      // 2. Re-fetch trees to pick up newly-cached imageUrls (optional but tidy)
      await loadTreesForActiveEstimate();

      // 3. Build KML using hosted URLs
      const kml = buildKml(
        exportable,
        imageUrls,
        `Estimate ${activeEstimateId.slice(0, 8)}`
      );
      const date = formatDateForFilename(Date.now());
      const filename = `estimate-${activeEstimateId.slice(0, 6)}-${date}.kml`;
      downloadKml(kml, filename);

      const skipped = activeTrees.length - exportable.length;
      setToast(
        skipped > 0
          ? `Exported ${exportable.length} trees (${skipped} skipped — no GPS)`
          : `Exported ${exportable.length} trees`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      setToast(`Export failed: ${msg}`);
    } finally {
      setExporting(false);
    }
  };

  const canExport = !!activeEstimateId && exportable.length > 0 && !exporting;

  return (
    <div className="px-4 py-6 pb-20">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Trees</h1>
        {activeTrees.length > 0 && (
          <button
            onClick={handleExport}
            disabled={!canExport}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-white text-sm font-medium active:bg-emerald-700 disabled:bg-gray-300 disabled:text-gray-500"
          >
            {exporting ? "Exporting..." : "Export KML"}
          </button>
        )}
      </div>

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
            const locationText = formatLocation(tree.lat ?? 0, tree.lng ?? 0);
            return (
              <li key={tree.id}>
                <Link
                  href={`/trees/${tree.id}`}
                  className="flex gap-3 rounded-lg bg-white border border-gray-200 p-3 active:bg-gray-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tree.image}
                    alt="Tree"
                    className="h-16 w-16 rounded-md object-cover bg-gray-100 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">
                      {new Date(tree.createdAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400 font-mono mb-1">
                      {locationText}
                    </p>
                    {scope.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">
                        No scope selected
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {scope.map((id) => (
                          <span
                            key={id}
                            className="inline-block rounded bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 border border-emerald-200"
                          >
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

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 max-w-[90%] rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg z-20">
          {toast}
        </div>
      )}
    </div>
  );
}