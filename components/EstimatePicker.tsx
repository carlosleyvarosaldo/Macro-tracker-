"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "@/lib/store";
import { Estimate } from "@/types";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Estimate IDs to NOT show (e.g. the current one). */
  excludeIds?: string[];
  /** Called when user picks an existing estimate. */
  onPick: (estimateId: string) => void;
  /** Title for the sheet. */
  title?: string;
};

function estimateDisplayName(estimate: Estimate): string {
  if (estimate.name?.trim()) return estimate.name;
  return `Estimate · ${new Date(estimate.createdAt).toLocaleDateString()}`;
}

export default function EstimatePicker({
  open,
  onClose,
  excludeIds = [],
  onPick,
  title = "Move to estimate",
}: Props) {
  const { estimates, createBlankEstimate } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setCreating(false);
      setNewName("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const visibleEstimates = estimates.filter((e) => !excludeIds.includes(e.id));

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const created = await createBlankEstimate(newName);
      onPick(created.id);
    } finally {
      setBusy(false);
    }
  };

  const sheet = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(0,0,0,0.5)",
          border: "none",
          padding: 0,
          margin: 0,
          cursor: "pointer",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100vw",
          maxWidth: "100vw",
          padding: 8,
          paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 8,
            boxShadow: "0 -10px 40px rgba(0,0,0,0.25)",
            maxHeight: "70vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "16px",
              textAlign: "center",
              borderBottom: "1px solid #e5e7eb",
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
            }}
          >
            {title}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {creating ? (
              <div style={{ padding: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#6b7280",
                    marginBottom: 6,
                  }}
                >
                  Estimate name (optional)
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Smith Property"
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    fontSize: 16,
                    border: "1px solid #d1d5db",
                    borderRadius: 10,
                    boxSizing: "border-box",
                  }}
                />
                <p
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    marginTop: 8,
                    lineHeight: 1.5,
                  }}
                >
                  Leave blank to auto-name from the address when the first photo
                  is captured.
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    disabled={busy}
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      background: "#ffffff",
                      color: "#374151",
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={busy}
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: "none",
                      background: "#10b981",
                      color: "#ffffff",
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: "pointer",
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    {busy ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "14px 16px",
                    background: "#ffffff",
                    border: "none",
                    borderBottom: "1px solid #e5e7eb",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "#10b981",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      fontWeight: 600,
                    }}
                  >
                    +
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      color: "#10b981",
                    }}
                  >
                    New estimate
                  </span>
                </button>

                {visibleEstimates.length === 0 && (
                  <p
                    style={{
                      padding: 24,
                      textAlign: "center",
                      fontSize: 14,
                      color: "#9ca3af",
                    }}
                  >
                    No other estimates yet
                  </p>
                )}

                {visibleEstimates.map((estimate) => (
                  <button
                    key={estimate.id}
                    type="button"
                    onClick={() => onPick(estimate.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "12px 16px",
                      background: "#ffffff",
                      border: "none",
                      borderBottom: "1px solid #e5e7eb",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 500,
                        color: "#111827",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {estimateDisplayName(estimate)}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        marginTop: 2,
                      }}
                    >
                      {new Date(estimate.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            display: "block",
            width: "100%",
            padding: 16,
            fontSize: 17,
            fontWeight: 600,
            color: "#2563eb",
            background: "#ffffff",
            borderRadius: 16,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 -10px 40px rgba(0,0,0,0.25)",
            fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}