"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CameraView from "./CameraView";
import TreesView from "./TreesView";
import DraftsView from "./DraftsView";
import WriteUpView from "./WriteUpView";

const PAGE_TREES = 0;
const PAGE_CAMERA = 1;
const PAGE_WRITEUP = 2;
const PAGE_DRAFTS = 3;
const PAGE_COUNT = 4;

const SWIPE_THRESHOLD = 0.25; // ratio of viewport width
const VELOCITY_THRESHOLD = 0.4; // px/ms

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
  const [swipeLocked, setSwipeLocked] = useState<boolean>(false);

  // Refs avoid React re-renders during the swipe gesture itself
  const innerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartYRef = useRef<number>(0);
  const dragStartTimeRef = useRef<number>(0);
  const axisLockRef = useRef<"unknown" | "horizontal" | "vertical">("unknown");
  const containerWidthRef = useRef<number>(0);

  // Apply transform directly via ref — bypasses React re-render
  const applyTransform = useCallback(
    (page: number, dragOffsetPx: number, animated: boolean) => {
      const inner = innerRef.current;
      if (!inner) return;
      const containerW = containerWidthRef.current || inner.clientWidth / PAGE_COUNT;
      const basePx = -page * containerW;
      inner.style.transition = animated
        ? "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)"
        : "none";
      inner.style.transform = `translate3d(${basePx + dragOffsetPx}px, 0, 0)`;
    },
    []
  );

  // Snap to current page whenever activePage changes
  useEffect(() => {
    applyTransform(activePage, 0, true);
  }, [activePage, applyTransform]);

  // Initialize the transform on mount and on resize
  useEffect(() => {
    const measure = () => {
      const c = containerRef.current;
      if (!c) return;
      containerWidthRef.current = c.clientWidth;
      applyTransform(activePage, 0, false);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = useCallback((page: number) => {
    const clamped = Math.max(0, Math.min(PAGE_COUNT - 1, page));
    setActivePage(clamped);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (swipeLocked) return;
    const t = e.touches[0];
    draggingRef.current = true;
    dragStartXRef.current = t.clientX;
    dragStartYRef.current = t.clientY;
    dragStartTimeRef.current = Date.now();
    axisLockRef.current = "unknown";
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggingRef.current || swipeLocked) return;
    const t = e.touches[0];
    const deltaX = t.clientX - dragStartXRef.current;
    const deltaY = t.clientY - dragStartYRef.current;

    // Axis lock: decide once whether this is a horizontal or vertical drag
    if (axisLockRef.current === "unknown") {
      const ax = Math.abs(deltaX);
      const ay = Math.abs(deltaY);
      if (ax < 8 && ay < 8) return; // not yet enough movement
      if (ay > ax) {
        axisLockRef.current = "vertical";
        return;
      }
      axisLockRef.current = "horizontal";
    }

    if (axisLockRef.current !== "horizontal") return;

    // Edge resistance
    let effectiveDelta = deltaX;
    if (
      (activePage === 0 && deltaX > 0) ||
      (activePage === PAGE_COUNT - 1 && deltaX < 0)
    ) {
      effectiveDelta = deltaX * 0.3;
    }

    // Direct DOM update, no React state change
    applyTransform(activePage, effectiveDelta, false);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    if (axisLockRef.current !== "horizontal") {
      // Not a swipe; just snap back (no-op since we never moved)
      return;
    }

    const t = e.changedTouches[0];
    const deltaX = t.clientX - dragStartXRef.current;
    const elapsed = Date.now() - dragStartTimeRef.current;
    const velocity = elapsed > 0 ? Math.abs(deltaX) / elapsed : 0;
    const ratio =
      Math.abs(deltaX) / (containerWidthRef.current / PAGE_COUNT || 1);

    let nextPage = activePage;
    if (ratio > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      if (deltaX < 0 && activePage < PAGE_COUNT - 1) nextPage = activePage + 1;
      else if (deltaX > 0 && activePage > 0) nextPage = activePage - 1;
    }

    if (nextPage === activePage) {
      // Snap back to current
      applyTransform(activePage, 0, true);
    } else {
      setActivePage(nextPage); // useEffect will snap to it
    }
  };

  return (
    <div
      ref={containerRef}
      className="h-screen w-screen overflow-hidden bg-black"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        ref={innerRef}
        style={{
          width: `${PAGE_COUNT * 100}%`,
          height: "100%",
          display: "flex",
          willChange: "transform",
        }}
      >
        <PageSlot active={activePage === PAGE_TREES}>
          <TreesView />
        </PageSlot>
        <PageSlot active={activePage === PAGE_CAMERA}>
          <CameraView
            isActive={activePage === PAGE_CAMERA}
            onSwipeLockChange={setSwipeLocked}
          />
        </PageSlot>
        <PageSlot active={activePage === PAGE_WRITEUP}>
          <WriteUpView />
        </PageSlot>
        <PageSlot active={activePage === PAGE_DRAFTS}>
          <DraftsView onSelectDraft={() => goTo(PAGE_TREES)} />
        </PageSlot>
      </div>

      {/* Page nav hints (only for non-edge pages) */}
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

/** Wraps each page with GPU-layer hints and CSS containment. */
function PageSlot({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: `${100 / PAGE_COUNT}%`,
        height: "100%",
        // Tell the browser this is an isolated stacking context.
        // 'paint' keeps repaints confined to the slot; 'layout' isolates layout work.
        // 'size' is omitted because children rely on the parent size.
        contain: "paint layout",
        // Hint that this slot's contents won't visually affect siblings
        transform: "translateZ(0)",
      }}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}