"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  initialName?: string;
  initialAddress?: string;
  onClose: () => void;
  onSave: (newName: string | undefined) => Promise<void>;
};

export default function RenameEstimateSheet({
  open,
  initialName,
  initialAddress,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(initialName ?? "");
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) setName(initialName ?? "");
  }, [open, initialName]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const handleSubmit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onSave(name.trim() || undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleResetToAddress = async () => {
    if (busy || !initialAddress) return;
    setBusy(true);
    try {
      await onSave(initialAddress);
    } finally {
      setBusy(false);
    }
  };

  const sheet = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rename estimate"
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
          padding: 8,
          paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: 16,
            padding: 16,
            marginBottom: 8,
            boxShadow: "0 -10px 40px rgba(0,0,0,0.25)",
          }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              textAlign: "center",
              marginTop: 0,
              marginBottom: 12,
            }}
          >
            Rename estimate
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Estimate name"
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
          {initialAddress && initialAddress !== name && (
            <button
              type="button"
              onClick={handleResetToAddress}
              disabled={busy}
              style={{
                marginTop: 8,
                fontSize: 13,
                color: "#10b981",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Use address: {initialAddress}
            </button>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              type="button"
              onClick={onClose}
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
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
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
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}