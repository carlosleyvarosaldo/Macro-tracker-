"use client";

import { memo, useCallback } from "react";
import { SCOPE_OPTIONS } from "@/lib/scope";

type Props = {
  selected: number[];
  onChange: (next: number[]) => void;
};

function ScopeSelectorImpl({ selected, onChange }: Props) {
  // Convert to Set once per render for fast membership checks
  const selectedSet = new Set(selected);

  const toggle = useCallback(
    (id: number) => {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Preserve numeric order for stable rendering
      onChange([...next].sort((a, b) => a - b));
    },
    [selected, onChange]
  );

  return (
    <div className="grid grid-cols-3 gap-2">
      {SCOPE_OPTIONS.map((opt) => {
        const active = selectedSet.has(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            className={`min-h-14 rounded-lg border px-2 py-2 text-xs font-medium leading-tight text-center transition-colors tap-press ${
              active
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-gray-300 bg-white text-gray-800 active:bg-gray-100"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export const ScopeSelector = memo(ScopeSelectorImpl);