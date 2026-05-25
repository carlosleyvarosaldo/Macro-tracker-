"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { getTreeById } from "@/lib/db";
import { processImageFile } from "@/lib/image";
import { ScopeSelector } from "@/components/ScopeSelector";
import { Tree } from "@/types";
import PhotoViewer from "@/components/PhotoViewer";
import MarkupCanvas, { MarkupCanvasHandle } from "@/components/MarkupCanvas";

type MarkupTool = "draw" | "erase" | "text";

export default function EditTreePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const updateTree = useAppStore((s) => s.updateTree);

  const [tree, setTree] = useState<Tree | null>(null);
  const [label, setLabel] = useState<string>("");
  const [images, setImages] = useState<string[]>([]);
  const [scopeItems, setScopeItems] = useState<number[]>([]);
  const [price, setPrice] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [dbh, setDbh] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Full-screen viewer
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Markup overlay
  const [markupIndex, setMarkupIndex] = useState<number | null>(null);
  const [markupTool, setMarkupTool] = useState<MarkupTool>("draw");
  const [strokeWidth, setStrokeWidth] = useState<number>(12);
  const [undoToken, setUndoToken] = useState(0);
  const markupRef = useRef<MarkupCanvasHandle>(null);

  useEffect(() => {
    if (!params?.id) return;
    getTreeById(params.id).then((t) => {
      if (!t) return;
      setTree(t);
      setLabel(t.label ?? "");
      setImages(t.images ?? (t.image ? [t.image] : []));
      setScopeItems(t.scopeItems ?? []);
      setPrice(String(t.price ?? 0));
      setNotes(t.notes ?? "");
      setDbh(t.dbh != null ? String(t.dbh) : "");
      setHeight(t.height != null ? String(t.height) : "");
    });
  }, [params?.id]);

  const handleAddPhotoClick = () => fileInputRef.current?.click();

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await processImageFile(file, 1920, 0.85);
      setImages((prev) => [...prev, dataUrl]);
    } catch {
      window.alert("Could not load that photo. Try another.");
    }
  };

  const handleRemovePhoto = (index: number) => {
    if (images.length <= 1) {
      window.alert("A tree needs at least one photo.");
      return;
    }
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const openMarkup = (index: number) => {
    setMarkupTool("draw");
    setMarkupIndex(index);
  };

  const handleApplyMarkup = () => {
    if (markupIndex === null) return;
    if (markupRef.current) {
      const merged = markupRef.current.exportJpeg(0.85);
      setImages((prev) => {
        const next = [...prev];
        next[markupIndex] = merged;
        return next;
      });
    }
    setMarkupIndex(null);
  };

  const parseOptionalNumber = (s: string): number | undefined => {
    const trimmed = s.trim();
    if (!trimmed) return undefined;
    const n = parseFloat(trimmed);
    return Number.isFinite(n) ? n : undefined;
  };

  const handleSave = async () => {
    if (!tree || saving) return;
    setSaving(true);
    try {
      const parsedPrice = parseFloat(price);
      await updateTree(tree.id, {
        label: label.trim() || undefined,
        images,
        image: images[0],
        scopeItems,
        price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        notes,
        dbh: parseOptionalNumber(dbh),
        height: parseOptionalNumber(height),
      });
      router.push("/");
    } finally {
      setSaving(false);
    }
  };

  if (!tree) {
    return (
      <div className="px-4 py-6">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  // --- Markup overlay (full screen) ---
  if (markupIndex !== null && images[markupIndex]) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        <div className="flex justify-between items-center px-3 py-2 bg-black/70 backdrop-blur-sm">
          <button
            onClick={() => setMarkupIndex(null)}
            className="text-white text-sm font-medium px-3 py-1.5 rounded-lg active:bg-white/10"
          >
            Cancel
          </button>
          <p className="text-white text-xs opacity-70">
            Mark up photo {markupIndex + 1}
          </p>
          <button
            onClick={handleApplyMarkup}
            className="text-white text-sm font-semibold px-3 py-1.5 rounded-lg active:bg-white/10"
          >
            Done
          </button>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <MarkupCanvas
            ref={markupRef}
            imageDataUrl={images[markupIndex]}
            tool={markupTool}
            undoToken={undoToken}
            strokeWidth={strokeWidth}
          />
        </div>

        <div className="bg-black px-4 pt-3 pb-2 flex gap-2 justify-center border-t border-white/10">
          {(["draw", "erase", "text"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMarkupTool(t)}
              className={`flex-1 max-w-[90px] py-2.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                markupTool === t
                  ? "bg-white text-black"
                  : "bg-white/10 text-white active:bg-white/20"
              }`}
            >
              {t}
            </button>
          ))}
          <button
            onClick={() => setUndoToken((n) => n + 1)}
            className="flex-1 max-w-[90px] py-2.5 rounded-lg text-sm font-medium bg-white/10 text-white active:bg-white/20"
          >
            Undo
          </button>
        </div>

        {(markupTool === "draw" || markupTool === "erase") && (
          <div
            className="bg-black px-4 pb-4 flex gap-2 justify-center"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
          >
            {[8, 12, 20, 28].map((w) => (
              <button
                key={w}
                onClick={() => setStrokeWidth(w)}
                className={`flex items-center justify-center rounded-full transition-colors ${
                  strokeWidth === w ? "bg-white" : "bg-white/10 active:bg-white/20"
                }`}
                style={{ width: 40, height: 40 }}
                aria-label={`Stroke ${w}px`}
              >
                <span
                  className={strokeWidth === w ? "bg-black" : "bg-white"}
                  style={{
                    display: "block",
                    width: w,
                    height: w,
                    borderRadius: "50%",
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white pb-16">
      {/* Photo grid */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-3 gap-2">
          {images.map((src, i) => (
            <div key={i} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Photo ${i + 1}`}
                onClick={() => setViewerIndex(i)}
                className="w-full h-full rounded-lg object-cover bg-gray-100 cursor-pointer"
              />
              {/* Remove button */}
              <button
                onClick={() => handleRemovePhoto(i)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center"
                aria-label={`Remove photo ${i + 1}`}
              >
                ✕
              </button>
              {/* Mark up button */}
              <button
                onClick={() => openMarkup(i)}
                className="absolute bottom-1 left-1 right-1 bg-black/60 text-white text-[11px] font-medium py-1 rounded active:bg-black/80 flex items-center justify-center gap-1"
                aria-label={`Mark up photo ${i + 1}`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 19l7-7 3 3-7 7-3-3z" />
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                  <path d="M2 2l7.586 7.586" />
                  <circle cx="11" cy="11" r="2" />
                </svg>
                Mark up
              </button>
            </div>
          ))}
          {/* Add photo tile */}
          <button
            onClick={handleAddPhotoClick}
            className="aspect-square rounded-lg border-2 border-dashed border-gray-300 text-gray-400 text-3xl active:bg-gray-50 flex items-center justify-center"
            aria-label="Add photo"
          >
            +
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Tap a photo to view full screen, or &ldquo;Mark up&rdquo; to draw on it.{" "}
          {images.length === 1 ? "1 photo" : `${images.length} photos`}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFilePicked}
          style={{ display: "none" }}
        />
      </div>

      <div className="px-4 py-4 space-y-5 flex-1">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base"
            placeholder='e.g. "Oak by driveway"'
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Price ($)
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base"
            placeholder="0"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              DBH (inches)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={dbh}
              onChange={(e) => setDbh(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base"
              placeholder="e.g. 24"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Height (feet)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="1"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base"
              placeholder="e.g. 45"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 -mt-3">
          Use Apple&apos;s Measure app or a tape — anything that gives you a number.
        </p>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base resize-none"
            placeholder="Optional notes"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            Scope of Work
          </label>
          <ScopeSelector selected={scopeItems} onChange={setScopeItems} />
        </div>
      </div>

      <div className="px-4 py-4 bg-white border-t border-gray-200 flex gap-3">
        <button
          onClick={() => router.push("/")}
          disabled={saving}
          className="flex-1 rounded-xl bg-gray-200 py-4 text-gray-800 font-semibold active:bg-gray-300 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-xl bg-emerald-600 py-4 text-white font-semibold active:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Full-screen viewer */}
      <PhotoViewer
        open={viewerIndex !== null}
        images={images}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
    </div>
  );
}