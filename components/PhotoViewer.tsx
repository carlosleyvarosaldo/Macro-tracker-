"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
};

export default function PhotoViewer({
  open,
  images,
  initialIndex = 0,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(initialIndex);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, images.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, images.length, onClose]);

  if (!open || !mounted || images.length === 0) return null;

  const hasMultiple = images.length > 1;
  const current = images[Math.max(0, Math.min(index, images.length - 1))];

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasMultiple) return;
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || !hasMultiple) {
      setTouchStartX(null);
      return;
    }
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 50) {
      if (delta < 0 && index < images.length - 1) {
        setIndex(index + 1);
      } else if (delta > 0 && index > 0) {
        setIndex(index - 1);
      }
    }
    setTouchStartX(null);
  };

  const viewer = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="anim-fade-in"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999,
        background: "rgba(0,0,0,0.95)",
        display: "flex",
        flexDirection: "column",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          paddingTop: "max(12px, env(safe-area-inset-top))",
          color: "white",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.8 }}>
          {hasMultiple ? `${index + 1} / ${images.length}` : ""}
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            color: "white",
            width: 36,
            height: 36,
            borderRadius: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Main photo area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
        onClick={onClose}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={index}
          src={current}
          alt={`Photo ${index + 1}`}
          onClick={(e) => e.stopPropagation()}
          className="anim-zoom-in"
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Thumbnail strip */}
      {hasMultiple && (
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            padding: "12px 16px",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          }}
        >
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              style={{
                flexShrink: 0,
                width: 56,
                height: 56,
                borderRadius: 8,
                overflow: "hidden",
                background: "#333",
                border:
                  i === index
                    ? "2px solid white"
                    : "2px solid rgba(255,255,255,0.2)",
                padding: 0,
                cursor: "pointer",
              }}
              aria-label={`Photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Thumbnail ${i + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return createPortal(viewer, document.body);
}