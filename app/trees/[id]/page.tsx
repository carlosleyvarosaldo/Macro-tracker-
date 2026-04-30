"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { getTreeById } from "@/lib/db";
import { ScopeSelector } from "@/components/ScopeSelector";
import { Tree } from "@/types";

export default function EditTreePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const updateTree = useAppStore((s) => s.updateTree);

  const [tree, setTree] = useState<Tree | null>(null);
  const [scopeItems, setScopeItems] = useState<number[]>([]);
  const [price, setPrice] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    getTreeById(params.id).then((t) => {
      if (!t) return;
      setTree(t);
      setScopeItems(t.scopeItems ?? []);
      setPrice(String(t.price ?? 0));
      setNotes(t.notes ?? "");
    });
  }, [params?.id]);

  const handleSave = async () => {
    if (!tree || saving) return;
    setSaving(true);
    try {
      const parsedPrice = parseFloat(price);
      await updateTree(tree.id, {
        scopeItems,
        price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        notes,
      });
      router.push("/trees");
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
      <div className="px-4 pt-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tree.image}
          alt="Tree"
          className="w-full h-40 object-cover rounded-lg bg-gray-100"
        />
      </div>

      <div className="px-4 py-4 space-y-5 flex-1">
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
          onClick={() => router.push("/trees")}
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