"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CameraView from "./CameraView";
import TreesView from "./TreesView";
import DraftsView from "./DraftsView";
import WriteUpView from "./WriteUpView";

// Page indices: 0 = Trees, 1 = Camera (default), 2 = Drafts
const PAGE_TREES = 0;
const PAGE_CAMERA = 1;
const PAGE_WRITEUP = 2;
const PAGE_DRAFTS = 3;
const PAGE_COUNT = 4;

const SWIPE_THRESHOLD = 0.2; // 20% of viewport triggers a page change
const VELOCITY_THRESHOLD = 0.5; // px/ms — fast flick triggers regardless of distance
function pageLabel(index: number): string {
  switch (index) {
    case PAGE_TREES:
      return "Trees";
    case PAGE_CAMERA:
      return "Camera";
    case PAGE_WRITEUP:
      return "Write-Up";
    case PAGE_DRAFTS:
      return "Drafts";
    default:
      return "";
  }
}
export default function SwipeShell() {
  const [activePage, setActivePage] = useState<number>(PAGE_CAMERA);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [swipeLocked, setSwipeLocked] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const lastTouchX = useRef<number>(0);
  // null = direction undetermined yet, "h" = horizontal swipe, "v" = vertical scroll
  const dragAxis = useRef<"h" | "v" | null>(null);

  const goTo = useCallback((page: number) => {
    setActivePage(Math.max(0, Math.min(PAGE_COUNT - 1, page)));
    setDragOffset(0);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (swipeLocked) return;
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    touchStartTime.current = Date.now();
    lastTouchX.current = t.clientX;
    dragAxis.current = null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const deltaX = t.clientX - touchStartX.current;
    const deltaY = t.clientY - touchStartY.current;

    // Lock axis on first meaningful movement
    if (dragAxis.current === null) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        dragAxis.current =
          Math.abs(deltaX) > Math.abs(deltaY) ? "h" : "v";
      }
    }

    if (dragAxis.current !== "h") return;

    lastTouchX.current = t.clientX;

    // Edge resistance — drag past page 0 or page 2 feels heavier
    let effectiveDelta = deltaX;
    if (
      (activePage === PAGE_TREES && deltaX > 0) ||
      (activePage === PAGE_DRAFTS && deltaX < 0)
    ) {
      effectiveDelta = deltaX * 0.3;
    }

    setDragOffset(effectiveDelta);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragAxis.current !== "h" || !containerRef.current) {
      setDragOffset(0);
      return;
    }

    const width = containerRef.current.clientWidth;
    const elapsed = Math.max(1, Date.now() - touchStartTime.current);
    const velocity = Math.abs(dragOffset) / elapsed;
    const ratio = Math.abs(dragOffset) / width;

    let nextPage = activePage;
    if (ratio > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      if (dragOffset < 0 && activePage < PAGE_COUNT - 1) nextPage = activePage + 1;
      else if (dragOffset > 0 && activePage > 0) nextPage = activePage - 1;
    }

    goTo(nextPage);
  };

  // Compute the transform: each page is 100% wide; full container is 300%
  // Active page index becomes the negative percentage shift.
  // Drag offset is added live in pixels.
  const baseShiftPercent = -activePage * (100 / PAGE_COUNT); // -0%, -25%, -50%, -75%
  const dragShiftPx = isDragging ? dragOffset : 0;

  const transformStyle: React.CSSProperties = {
    width: `${PAGE_COUNT * 100}%`,
    transform: `translateX(calc(${baseShiftPercent}% + ${dragShiftPx}px))`,
    transition: isDragging ? "none" : "transform 250ms ease-out",
    display: "flex",
    height: "100%",
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {/* Pages container */}
      <div
        ref={containerRef}
        className="h-full overflow-hidden touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div style={transformStyle}>
          <div style={{ width: `${100 / PAGE_COUNT}%` }} className="h-full">
            <TreesView />
          </div>
          <div style={{ width: `${100 / PAGE_COUNT}%` }} className="h-full">
            <CameraView
              isActive={activePage === PAGE_CAMERA && !isDragging}
              onSwipeLockChange={setSwipeLocked}
            />
          </div>
          <div style={{ width: `${100 / PAGE_COUNT}%` }} className="h-full">
            <WriteUpView />
          </div>
          <div style={{ width: `${100 / PAGE_COUNT}%` }} className="h-full">
            <DraftsView onSelectDraft={() => goTo(PAGE_TREES)} />
          </div>
        </div>
      </div>

      {/* Top-edge fallback nav buttons */}
      <div className="pointer-events-none fixed top-0 left-0 right-0 z-30 flex justify-between px-2 pt-2">
        {activePage > 0 ? (
          <button
            onClick={() => goTo(activePage - 1)}
            className="pointer-events-auto rounded-full bg-black/40 backdrop-blur-sm text-white text-xs px-3 py-1.5 active:bg-black/60"
          >
            ← {pageLabel(activePage - 1)}
          </button>
        ) : (
          <span />
        )}
        {activePage < PAGE_COUNT - 1 ? (
          <button
            onClick={() => goTo(activePage + 1)}
            className="pointer-events-auto rounded-full bg-black/40 backdrop-blur-sm text-white text-xs px-3 py-1.5 active:bg-black/60"
          >
            {pageLabel(activePage + 1)} →
          </button>
        ) : (
          <span />
        )}
      </div>

      {/* Page indicator dots */}
      <div className="pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-30">
        {Array.from({ length: PAGE_COUNT }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              i === activePage ? "bg-white" : "bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}