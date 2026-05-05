"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Action = {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: ReactNode;
  actions: Action[];
  cancelLabel?: string;
};

const SHEET_BG = "#ffffff";
const SHEET_SHADOW = "0 -10px 40px rgba(0,0,0,0.25)";
const SEPARATOR = "1px solid #e5e7eb";

export default function ActionSheet({
  open,
  onClose,
  title,
  description,
  actions,
  cancelLabel = "Cancel",
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const sheet = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || "Action sheet"}
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
          padding: "8px",
          paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            background: SHEET_BG,
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 8,
            boxShadow: SHEET_SHADOW,
          }}
        >
          {(title || description) && (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                borderBottom: SEPARATOR,
                background: SHEET_BG,
              }}
            >
              {title && (
                <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: 0, lineHeight: 1.3 }}>
                  {title}
                </p>
              )}
              {description && (
                <p style={{ fontSize: 13, color: "#6b7280", margin: "6px 0 0 0", lineHeight: 1.5 }}>
                  {description}
                </p>
              )}
            </div>
          )}
          {actions.length > 0 ? (
            <div>
              {actions.map((action, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (action.disabled) return;
                    action.onClick();
                  }}
                  disabled={action.disabled}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "16px",
                    fontSize: 17,
                    fontWeight: action.destructive ? 600 : 400,
                    color: action.destructive ? "#dc2626" : "#2563eb",
                    background: SHEET_BG,
                    border: "none",
                    borderTop: i > 0 ? SEPARATOR : "none",
                    cursor: "pointer",
                    opacity: action.disabled ? 0.5 : 1,
                    fontFamily: "inherit",
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : (
            <p style={{ padding: "24px 16px", textAlign: "center", fontSize: 14, color: "#6b7280" }}>
              No actions available
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            display: "block",
            width: "100%",
            padding: "16px",
            fontSize: 17,
            fontWeight: 600,
            color: "#2563eb",
            background: SHEET_BG,
            borderRadius: 16,
            border: "none",
            cursor: "pointer",
            boxShadow: SHEET_SHADOW,
            fontFamily: "inherit",
          }}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}