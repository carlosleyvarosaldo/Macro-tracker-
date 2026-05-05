"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { getScopeLabel } from "@/lib/scope";
import { buildKml, downloadKml, downloadBlob, hasValidLocation } from "@/lib/kml";
import { ensureAllTreeImagesUploaded } from "@/lib/upload";
import { buildEstimatePdf } from "@/lib/pdf";
import { resolveEstimateWriteUp } from "@/lib/writeup";
import { Tree } from "@/types";
import ActionSheet from "@/components/ui/ActionSheet";
import EstimatePicker from "@/components/EstimatePicker";
import Toast from "@/components/ui/Toast";

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
    moveTreeToEstimate,
  } = useAppStore();
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportKind>(null);
  const [pendingActions, setPendingActions] = useState<Tree | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Tree | null>(null);
  const [movingTree, setMovingTree] = useState<Tree | null>(null);

  useEffect(() => {
    loadTreesForActiveEstimate();
  }, [activeEstimateId, loadTreesForActiveEstimate]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
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
    return buildEstimatePdf(activeTrees, writeUp, {
      estimateName: activeEstimate?.name,
      address: activeEstimate?.address,
      createdAt: activeEstimate?.createdAt,
    });
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
      activeEstimate?.name || `Estimate ${activeEstimateId?.slice(0, 8) ?? ""}`
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
      setToast("PDF exported");
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
        downloadBlob(pdfBlob, baseFilename("pdf"));
        if (files.length > 1) {
          await new Promise((r) => setTimeout(r, 400));
          const kmlFile = files[1];
          downloadBlob(kmlFile, kmlFile.name);
        }
        setToast("Downloaded — share not available on this device");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setToast(null);
      } else {
        setToast(`Share failed: ${err instanceof Error ? err.message : ""}`);
      }
    } finally {
      setExporting(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    await deleteTree(id);
  };

  const handleMoveTree = async (newEstimateId: string) => {
    if (!movingTree) return;
    const treeToMove = movingTree;
    setMovingTree(null);
    await moveTreeToEstimate(treeToMove.id, newEstimateId);
    const target = estimates.find((e) => e.id === newEstimateId);
    setToast(`Moved to ${target?.name?.trim() || "new estimate"}`);
  };

  return (
    <div className="h-full overflow-y-auto bg-[var(--ios-bg)] ios-scroll">
      <div className="px-3 py-6 pb-24">
        <div className="px-1 mb-4">
          <h1 className="text-[28px] font-bold tracking-tight text-gray-900">
            Trees
          </h1>
          {activeEstimate && (
            <p className="text-[15px] text-gray-500 mt-0.5 truncate">
              {activeEstimate.name?.trim() || "Untitled estimate"}
            </p>
          )}
          {activeTrees.length > 0 && (
            <p className="text-[15px] text-gray-500 mt-0.5">
              {activeTrees.length} {activeTrees.length === 1 ? "tree" : "trees"} ·
              <span className="text-gray-900 font-semibold">
                {" "}${total.toFixed(2)}
              </span>
            </p>
          )}
        </div>

        {activeTrees.length > 0 && (
          <div className="px-1 mb-4 flex gap-2">
            <button
              onClick={handleShare}
              disabled={!activeEstimateId || activeTrees.length === 0 || !!exporting}
              className="flex-1 rounded-2xl bg-emerald-600 py-3 text-white text-[15px] font-semibold active:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {exporting === "share" ? (
                <span className="ios-spinner light" />
              ) : (
                <svg
                  width="16"
                  height="16"
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
              )}
              <span>Share</span>
            </button>
            <button
              onClick={handleExportPdf}
              disabled={!activeEstimateId || activeTrees.length === 0 || !!exporting}
              className="rounded-2xl bg-white border border-gray-200 px-4 py-3 text-gray-800 text-[15px] font-semibold active:bg-gray-50 disabled:opacity-50"
            >
              {exporting === "pdf" ? <span className="ios-spinner" /> : "PDF"}
            </button>
            <button
              onClick={handleExportKml}
              disabled={!activeEstimateId || exportable.length === 0 || !!exporting}
              className="rounded-2xl bg-white border border-gray-200 px-4 py-3 text-gray-800 text-[15px] font-semibold active:bg-gray-50 disabled:opacity-50"
            >
              {exporting === "kml" ? <span className="ios-spinner" /> : "KML"}
            </button>
          </div>
        )}

        {!activeEstimateId && (
          <div className="bg-white rounded-xl border border-gray-200/70 p-6 text-center">
            <p className="text-[15px] text-gray-500">No active estimate</p>
            <p className="text-[13px] text-gray-400 mt-1">
              Swipe to Drafts to pick or create one
            </p>
          </div>
        )}

        {activeEstimateId && activeTrees.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200/70 p-6 text-center">
            <p className="text-[15px] text-gray-500">No trees yet</p>
            <p className="text-[13px] text-gray-400 mt-1">
              Swipe to Camera to capture one
            </p>
          </div>
        )}

        {activeTrees.length > 0 && (
          <div className="bg-white rounded-xl overflow-hidden border border-gray-200/70 divide-y divide-gray-200/70">
            {activeTrees.map((tree) => {
              const scope = tree.scopeItems ?? [];
              const locationText = formatLocation(tree.lat ?? 0, tree.lng ?? 0);
              const primaryImage = tree.images?.[0] ?? tree.image ?? "";
              const photoCount = tree.images?.length ?? (tree.image ? 1 : 0);
              const measurementParts: string[] = [];
              if (tree.dbh != null) measurementParts.push(`DBH ${tree.dbh}"`);
              if (tree.height != null) measurementParts.push(`H ${tree.height}'`);

              return (
                <div key={tree.id} className="relative">
                  <Link
                    href={`/trees/${tree.id}`}
                    className="flex gap-3 p-3 pr-12 active:bg-gray-50"
                  >
                    <div className="relative h-16 w-16 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={primaryImage}
                        alt="Tree"
                        className="h-16 w-16 rounded-lg object-cover bg-gray-100"
                      />
                      {photoCount > 1 && (
                        <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                          {photoCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-gray-900 truncate">
                        {tree.label?.trim() ||
                          `Tree ${activeTrees.indexOf(tree) + 1}`}
                      </p>
                      <p className="text-[13px] text-gray-500 truncate">
                        {locationText}
                      </p>
                      {(measurementParts.length > 0 || tree.price > 0) && (
                        <p className="text-[13px] text-gray-700 mt-0.5">
                          {tree.price > 0 && (
                            <span className="font-semibold">
                              ${tree.price.toFixed(2)}
                            </span>
                          )}
                          {tree.price > 0 && measurementParts.length > 0 && (
                            <span className="text-gray-400 mx-1">·</span>
                          )}
                          {measurementParts.length > 0 && measurementParts.join(" · ")}
                        </p>
                      )}
                      {scope.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {scope.slice(0, 3).map((id) => (
                            <span
                              key={id}
                              className="inline-block rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-medium px-1.5 py-0.5"
                            >
                              {getScopeLabel(id)}
                            </span>
                          ))}
                          {scope.length > 3 && (
                            <span className="text-[11px] text-gray-400 self-center">
                              +{scope.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPendingActions(tree);
                    }}
                    aria-label="More actions"
                    className="absolute top-1/2 right-2 -translate-y-1/2 w-9 h-9 rounded-full text-gray-400 active:bg-gray-100 active:text-gray-600 flex items-center justify-center"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <circle cx="5" cy="12" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="19" cy="12" r="2" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {toast && <Toast message={toast} />}
      </div>

      {/* Per-tree action sheet */}
      <ActionSheet
        open={pendingActions !== null}
        onClose={() => setPendingActions(null)}
        title={pendingActions?.label?.trim() || "Tree actions"}
        actions={
          pendingActions
            ? [
                {
                  label: "Move to another estimate",
                  onClick: () => {
                    const target = pendingActions;
                    setPendingActions(null);
                    setMovingTree(target);
                  },
                },
                {
                  label: "Delete",
                  destructive: true,
                  onClick: () => {
                    const target = pendingActions;
                    setPendingActions(null);
                    setPendingDelete(target);
                  },
                },
              ]
            : []
        }
      />

      {/* Delete confirm sheet */}
      <ActionSheet
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete tree?"
        description={
          pendingDelete?.label?.trim()
            ? `"${pendingDelete.label}" will be removed. This cannot be undone.`
            : "This tree will be removed. This cannot be undone."
        }
        actions={[
          {
            label: "Delete",
            destructive: true,
            onClick: confirmDelete,
          },
        ]}
      />

      {/* Move-to-estimate picker */}
      <EstimatePicker
        open={movingTree !== null}
        onClose={() => setMovingTree(null)}
        excludeIds={activeEstimateId ? [activeEstimateId] : []}
        onPick={handleMoveTree}
        title="Move tree to..."
      />
    </div>
  );
}