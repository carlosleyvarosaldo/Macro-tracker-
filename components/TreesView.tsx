"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { getScopeLabel } from "@/lib/scope";
import { buildKml, downloadKml, downloadBlob, hasValidLocation } from "@/lib/kml";
import { ensureAllTreeImagesUploaded } from "@/lib/upload";
import { buildEstimatePdf } from "@/lib/pdf";
import { resolveEstimateWriteUp } from "@/lib/writeup";

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

type ExportKind = "kml" | "pdf" | "share" | null;

export default function TreesView() {
  const {
    activeEstimateId,
    activeTrees,
    estimates,
    loadTreesForActiveEstimate,
    deleteTree,
  } = useAppStore();
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportKind>(null);

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
  const total = useMemo(
    () => activeTrees.reduce((sum, t) => sum + (t.price ?? 0), 0),
    [activeTrees]
  );

  const activeEstimate = useMemo(
    () => estimates.find((e) => e.id === activeEstimateId),
    [estimates, activeEstimateId]
  );

  const buildPdfBlob = async (): Promise<Blob> => {
    const writeUp = resolveEstimateWriteUp(activeEstimate, activeTrees);
    return buildEstimatePdf(activeTrees, writeUp);
  };

  const buildKmlBlob = async (): Promise<Blob> => {
    const imageUrls = await ensureAllTreeImagesUploaded(
      exportable,
      (done, t) => setToast(`Uploading photos ${done}/${t}...`)
    );
    await loadTreesForActiveEstimate();
    const kml = buildKml(
      exportable,
      imageUrls,
      `Estimate ${activeEstimateId?.slice(0, 8) ?? ""}`
    );
    return new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
  };

  const baseFilename = (ext: string): string => {
    const date = formatDateForFilename(Date.now());
    const id = activeEstimateId?.slice(0, 6) ?? "estimate";
    return `estimate-${id}-${date}.${ext}`;
  };

  const handleExportKml = async () => {
    if (!activeEstimateId || exportable.length === 0 || exporting) return;
    setExporting("kml");
    try {
      const blob = await buildKmlBlob();
      downloadKml(await blob.text(), baseFilename("kml"));
      const skipped = activeTrees.length - exportable.length;
      setToast(
        skipped > 0
          ? `Exported ${exportable.length} trees (${skipped} skipped — no GPS)`
          : `Exported ${exportable.length} trees`
      );
    } catch (err) {
      setToast(`Export failed: ${err instanceof Error ? err.message : ""}`);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    if (!activeEstimateId || activeTrees.length === 0 || exporting) return;
    setExporting("pdf");
    setToast("Generating PDF...");
    try {
      const blob = await buildPdfBlob();
      downloadBlob(blob, baseFilename("pdf"));
      setToast(`PDF exported (${activeTrees.length} trees)`);
    } catch (err) {
      setToast(`Export failed: ${err instanceof Error ? err.message : ""}`);
    } finally {
      setExporting(null);
    }
  };

  const handleShare = async () => {
    if (!activeEstimateId || activeTrees.length === 0 || exporting) return;
    setExporting("share");
    setToast("Preparing share...");
    try {
      const pdfBlob = await buildPdfBlob();
      const files: File[] = [
        new File([pdfBlob], baseFilename("pdf"), { type: "application/pdf" }),
      ];

      // Add KML only if there's at least one tree with GPS
      if (exportable.length > 0) {
        const kmlBlob = await buildKmlBlob();
        files.push(
          new File([kmlBlob], baseFilename("kml"), {
            type: "application/vnd.google-earth.kml+xml",
          })
        );
      }

      const shareData: ShareData = {
        title: activeEstimate?.name || "Tree Estimate",
        text: `Tree estimate · ${activeTrees.length} trees · Total $${total.toFixed(2)}`,
        files,
      };

      const canShareFiles =
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare(shareData);

      if (canShareFiles) {
        await navigator.share(shareData);
        setToast("Shared");
      } else {
        // Fallback: download both files
        downloadBlob(pdfBlob, baseFilename("pdf"));
        if (files.length > 1) {
          // Download KML separately a moment later
          await new Promise((r) => setTimeout(r, 400));
          const kmlFile = files[1];
          downloadBlob(kmlFile, kmlFile.name);
        }
        setToast("Downloaded — share not available on this device");
      }
    } catch (err) {
      // AbortError fires when user cancels the share sheet — ignore silently
      if (err instanceof Error && err.name === "AbortError") {
        setToast(null);
      } else {
        setToast(`Share failed: ${err instanceof Error ? err.message : ""}`);
      }
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="px-4 py-6 pb-20">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-semibold">Trees</h1>
        </div>

        {activeTrees.length > 0 && (
          <div className="flex items-center justify-between mb-4 gap-2">
            <p className="text-sm text-gray-600">
              Total:{" "}
              <span className="font-semibold text-gray-900">
                ${total.toFixed(2)}
              </span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                disabled={
                  !activeEstimateId || activeTrees.length === 0 || !!exporting
                }
                className="rounded-lg bg-emerald-600 px-3 py-2 text-white text-sm font-medium active:bg-emerald-700 disabled:bg-gray-300 disabled:text-gray-500 flex items-center gap-1"
                aria-label="Share estimate"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                {exporting === "share" ? "..." : "Share"}
              </button>
              <button
                onClick={handleExportPdf}
                disabled={
                  !activeEstimateId || activeTrees.length === 0 || !!exporting
                }
                className="rounded-lg bg-white border border-gray-300 px-3 py-2 text-gray-700 text-sm font-medium active:bg-gray-100 disabled:opacity-50"
              >
                {exporting === "pdf" ? "..." : "PDF"}
              </button>
              <button
                onClick={handleExportKml}
                disabled={
                  !activeEstimateId || exportable.length === 0 || !!exporting
                }
                className="rounded-lg bg-white border border-gray-300 px-3 py-2 text-gray-700 text-sm font-medium active:bg-gray-100 disabled:opacity-50"
              >
                {exporting === "kml" ? "..." : "KML"}
              </button>
            </div>
          </div>
        )}

        {!activeEstimateId && (
          <p className="text-gray-500 text-sm">
            No active estimate. Tap Camera to start one.
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
              const treeName = tree.label?.trim() || "this tree";
              const primaryImage = tree.images?.[0] ?? tree.image ?? "";
              const photoCount = tree.images?.length ?? (tree.image ? 1 : 0);
              const measurementParts: string[] = [];
              if (tree.dbh != null) measurementParts.push(`DBH ${tree.dbh}"`);
              if (tree.height != null) measurementParts.push(`H ${tree.height}'`);

              return (
                <li
                  key={tree.id}
                  className="relative rounded-lg bg-white border border-gray-200"
                >
                  <Link
                    href={`/trees/${tree.id}`}
                    className="flex gap-3 p-3 pr-12 active:bg-gray-50 rounded-lg"
                  >
                    <div className="relative h-16 w-16 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={primaryImage}
                        alt="Tree"
                        className="h-16 w-16 rounded-md object-cover bg-gray-100"
                      />
                      {photoCount > 1 && (
                        <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                          {photoCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {tree.label?.trim() && (
                        <p className="text-sm font-semibold text-gray-900">
                          {tree.label}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        {new Date(tree.createdAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400 font-mono mb-1">
                        {locationText}
                      </p>
                      {measurementParts.length > 0 && (
                        <p className="text-xs text-gray-600 mb-1">
                          {measurementParts.join(" · ")}
                        </p>
                      )}
                      {tree.price > 0 && (
                        <p className="text-sm font-semibold text-gray-800 mb-1">
                          ${tree.price.toFixed(2)}
                        </p>
                      )}
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
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const ok = window.confirm(
                        `Delete ${treeName}? This cannot be undone.`
                      );
                      if (!ok) return;
                      await deleteTree(tree.id);
                    }}
                    aria-label="Delete tree"
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

        {toast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 max-w-[90%] rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg z-20 text-center">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}