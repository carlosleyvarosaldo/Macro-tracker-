"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { getTreeById } from "@/lib/db";
import { processImageFile } from "@/lib/image";
import { ScopeSelector } from "@/components/ScopeSelector";
import { Tree } from "@/types";

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

  const handleMakePrimary = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const next = [...prev];
      const [picked] = next.splice(index, 1);
      next.unshift(picked);
      return next;
    });
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

  return (
    <div className="flex min-h-screen flex-col bg-white pb-16">
      {/* Photo strip */}
      <div className="px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((src, i) => (
            <div key={i} className="relative flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Photo ${i + 1}`}
                onClick={() => handleMakePrimary(i)}
                className={`w-28 h-28 rounded-lg object-cover bg-gray-100 cursor-pointer ${
                  i === 0 ? "ring-2 ring-emerald-600" : ""
                }`}
              />
              {i === 0 && (
                <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                  Primary
                </span>
              )}
              <button
                onClick={() => handleRemovePhoto(i)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center"
                aria-label={`Remove photo ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={handleAddPhotoClick}
            className="flex-shrink-0 w-28 h-28 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 text-3xl active:bg-gray-50"
            aria-label="Add photo"
          >
            +
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Tap a photo to make it primary.{" "}
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

        {/* Measurements — DBH and Height side by side */}
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
    </div>
  );
}