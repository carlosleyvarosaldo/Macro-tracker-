"use client";

import { useMemo } from "react";
import {
  SCOPE_OPTIONS,
  ScopeOption,
  ScopeGroup,
  getScopeOptionsByGroup,
  getScopeGroupOrder,
} from "@/lib/scope";

type Props = {
  selected: number[];
  onChange: (next: number[]) => void;
};

export function ScopeSelector({ selected, onChange }: Props) {
  const grouped = useMemo(() => getScopeOptionsByGroup(), []);
  const groups = useMemo(() => getScopeGroupOrder(), []);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (id: number) => {
    if (selectedSet.has(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const items = grouped[group];
        if (!items || items.length === 0) return null;
        return (
          <div key={group}>
            <p className="px-1 mb-2 text-[12px] uppercase tracking-wider font-semibold text-gray-500">
              {group}
            </p>
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-200/70 divide-y divide-gray-200/70">
              {items.map((opt) => (
                <ScopeRow
                  key={opt.id}
                  option={opt}
                  selected={selectedSet.has(opt.id)}
                  onToggle={() => toggle(opt.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type RowProps = {
  option: ScopeOption;
  selected: boolean;
  onToggle: () => void;
};

function ScopeRow({ option, selected, onToggle }: RowProps) {
  const isMultiIcon = option.icon.paths.length > 1;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`tap-press w-full flex items-center gap-3 px-3 py-3 text-left ${
        selected ? "bg-emerald-50" : "bg-white"
      } active:bg-gray-50`}
    >
      {/* Icon area — single or stacked thumbnails */}
      <div
        className="flex-shrink-0 flex items-center"
        style={{ width: isMultiIcon ? 96 : 56, height: 56 }}
      >
        {isMultiIcon ? (
          <div className="flex gap-1">
            {option.icon.paths.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt=""
                className="rounded-md object-contain bg-gray-50"
                style={{ width: 28, height: 28 }}
              />
            ))}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={option.icon.paths[0]}
            alt=""
            className="rounded-md object-contain bg-gray-50"
            style={{ width: 56, height: 56 }}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={`text-[16px] font-medium leading-snug ${
            selected ? "text-emerald-800" : "text-gray-900"
          }`}
        >
          {option.label}
        </p>
        {option.description && (
          <p className="text-[13px] text-gray-500 leading-snug mt-0.5">
            {option.description}
          </p>
        )}
      </div>

      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
          selected
            ? "bg-emerald-600"
            : "bg-transparent border-2 border-gray-300"
        }`}
      >
        {selected && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
    </button>
  );
}

// Backward compat: some places imported SCOPE_OPTIONS as a string[] of labels.
// Keep this named export for legacy code that hasn't been migrated yet.
export const LEGACY_SCOPE_LABELS = SCOPE_OPTIONS.map((o) => o.label);