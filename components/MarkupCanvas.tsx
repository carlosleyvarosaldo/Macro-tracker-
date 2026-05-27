"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from "react";

type Tool = "draw" | "erase" | "text";

type StrokePoint = { x: number; y: number };

type Stroke = {
  kind: "stroke";
  points: StrokePoint[];
  color: string;
  width: number;
  erase: boolean;
};

type TextLabel = {
  id: string;
  text: string;
  x: number;
  y: number;
  baseSize: number;
  scale: number;
  rotation: number;
  color: string;
};

export type MarkupAction = Stroke;

const STROKE_COLOR = "#ff3b30";
const ERASE_MULTIPLIER = 3;
const TEXT_COLOR = "#ff3b30";
const TEXT_BASE_SIZE = 140;

export type MarkupCanvasHandle = {
  exportJpeg: (quality?: number) => string;
  getHistory: () => MarkupAction[];
  setHistory: (actions: MarkupAction[]) => void;
};

type Props = {
  imageDataUrl: string;
  tool: Tool;
  undoToken: number;
  strokeWidth: number;
  imageSwapToken?: number;
  initialHistory?: MarkupAction[];
};

const MarkupCanvas = forwardRef<MarkupCanvasHandle, Props>(function MarkupCanvas(
  { imageDataUrl, tool, undoToken, strokeWidth, imageSwapToken, initialHistory },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const markupCanvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef<{ w: number; h: number } | null>(null);
  const historyRef = useRef<Stroke[]>((initialHistory as Stroke[]) ?? []);
  const currentStrokeRef = useRef<Stroke | null>(null);

  const [labels, setLabels] = useState<TextLabel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);

  // Track active pointers globally (any pointer on the markup area)
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  // Gesture state for the currently-selected label
  type Gesture =
    | { mode: "none" }
    | {
        mode: "drag";
        labelId: string;
        offsetX: number;
        offsetY: number;
        pointerId: number;
      }
    | {
        mode: "pinch";
        labelId: string;
        startDist: number;
        startAngle: number;
        startScale: number;
        startRotation: number;
      };
  const gestureRef = useRef<Gesture>({ mode: "none" });

  // ---- Canvas rendering ----

  const renderImage = useCallback((img: HTMLImageElement) => {
    const canvas = imageCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }, []);

  const renderMarkup = useCallback(() => {
    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "square";
    ctx.lineJoin = "round";

    for (const action of historyRef.current) {
      ctx.globalCompositeOperation = action.erase
        ? "destination-out"
        : "source-over";
      ctx.strokeStyle = action.color;
      ctx.lineWidth = action.width;
      const pts = action.points;
      if (pts.length === 0) continue;
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, action.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = action.color;
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }, []);

  const renderActiveStroke = useCallback(() => {
    const canvas = markupCanvasRef.current;
    const stroke = currentStrokeRef.current;
    if (!canvas || !stroke || stroke.points.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const a = stroke.points[stroke.points.length - 2];
    const b = stroke.points[stroke.points.length - 1];
    ctx.globalCompositeOperation = stroke.erase
      ? "destination-out"
      : "source-over";
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "square";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }, []);

  // Load image
  useEffect(() => {
    setImageReady(false);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || 1280;
      const h = img.naturalHeight || 720;
      sizeRef.current = { w, h };
      [imageCanvasRef, markupCanvasRef].forEach((r) => {
        if (r.current) {
          r.current.width = w;
          r.current.height = h;
        }
      });
      renderImage(img);
      renderMarkup();
      setImageReady(true);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl, renderImage, renderMarkup]);

  // Photo swap (multi-image flow)
  useEffect(() => {
    if (imageSwapToken === undefined) return;
    historyRef.current = (initialHistory as Stroke[]) ?? [];
    setLabels([]);
    setSelectedId(null);
    renderMarkup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSwapToken]);

  // Tool change deselects label
  useEffect(() => {
    if (tool !== "text") {
      setSelectedId(null);
    }
  }, [tool]);

  // Undo
  useEffect(() => {
    if (undoToken === 0) return;
    setLabels((prev) => {
      if (prev.length > 0) {
        return prev.slice(0, -1);
      }
      if (historyRef.current.length > 0) {
        historyRef.current.pop();
        renderMarkup();
      }
      return prev;
    });
  }, [undoToken, renderMarkup]);

  // ---- Coordinate helpers ----

  const getCanvasLayout = useCallback(() => {
    const canvas = markupCanvasRef.current;
    const container = containerRef.current;
    const size = sizeRef.current;
    if (!canvas || !container || !size) return null;
    const cRect = container.getBoundingClientRect();
    const scale = Math.min(cRect.width / size.w, cRect.height / size.h);
    const dispW = size.w * scale;
    const dispH = size.h * scale;
    const offsetX = cRect.left + (cRect.width - dispW) / 2;
    const offsetY = cRect.top + (cRect.height - dispH) / 2;
    return { scale, offsetX, offsetY, dispW, dispH };
  }, []);

  const screenToCanvas = useCallback(
    (clientX: number, clientY: number): StrokePoint | null => {
      const layout = getCanvasLayout();
      if (!layout) return null;
      return {
        x: (clientX - layout.offsetX) / layout.scale,
        y: (clientY - layout.offsetY) / layout.scale,
      };
    },
    [getCanvasLayout]
  );

  const distAngle = (
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return { dist: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) };
  };

  // ---- Unified pointer handler ----
  // When a label is selected and we're in text mode, ALL pointer events become
  // gestures on that label. Otherwise they're stroke or text-creation events.

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Always track active pointers
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // If user tapped a button on a selected label, let that handle it
    if (target.closest("[data-label-button]")) {
      return;
    }

    // Did the tap land on a label?
    const tappedLabelEl = target.closest("[data-label-id]") as HTMLElement | null;
    const tappedLabelId = tappedLabelEl?.dataset.labelId ?? null;

    // --- Text tool, no label currently selected ---
    if (tool === "text" && selectedId === null) {
      if (tappedLabelId) {
        // Select the tapped label
        setSelectedId(tappedLabelId);
      } else {
        // Create a new label at this position
        const pt = screenToCanvas(e.clientX, e.clientY);
        if (!pt) return;
        const input = window.prompt("Add a label:");
        if (!input || !input.trim()) return;
        const label: TextLabel = {
          id: crypto.randomUUID(),
          text: input.trim(),
          x: pt.x,
          y: pt.y,
          baseSize: TEXT_BASE_SIZE,
          scale: 1,
          rotation: 0,
          color: TEXT_COLOR,
        };
        setLabels((prev) => [...prev, label]);
        setSelectedId(label.id);
      }
      return;
    }

    // --- Text tool, a label IS selected — interpret as gesture ---
    if (tool === "text" && selectedId !== null) {
      // If they tapped a DIFFERENT label, switch selection
      if (tappedLabelId && tappedLabelId !== selectedId) {
        setSelectedId(tappedLabelId);
        return;
      }

      // First finger → start drag
      // Second finger → upgrade to pinch
      const activePointers = Array.from(pointersRef.current.entries());
      const selectedLabel = labels.find((l) => l.id === selectedId);
      if (!selectedLabel) return;

      if (activePointers.length === 1) {
        // First pointer down — drag mode
        const pt = screenToCanvas(e.clientX, e.clientY);
        if (!pt) return;
        gestureRef.current = {
          mode: "drag",
          labelId: selectedLabel.id,
          offsetX: selectedLabel.x - pt.x,
          offsetY: selectedLabel.y - pt.y,
          pointerId: e.pointerId,
        };
      } else if (activePointers.length === 2) {
        // Second pointer down — pinch mode
        const [, p1] = activePointers[0];
        const [, p2] = activePointers[1];
        const { dist, angle } = distAngle(p1, p2);
        gestureRef.current = {
          mode: "pinch",
          labelId: selectedLabel.id,
          startDist: dist || 1,
          startAngle: angle,
          startScale: selectedLabel.scale,
          startRotation: selectedLabel.rotation,
        };
      }
      return;
    }

    // --- Draw / erase tool ---
    e.preventDefault();
    setSelectedId(null);
    const point = screenToCanvas(e.clientX, e.clientY);
    if (!point) return;
    const stroke: Stroke = {
      kind: "stroke",
      points: [point],
      color: STROKE_COLOR,
      width: tool === "erase" ? strokeWidth * ERASE_MULTIPLIER : strokeWidth,
      erase: tool === "erase",
    };
    currentStrokeRef.current = stroke;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Stroke in progress
    if (currentStrokeRef.current) {
      e.preventDefault();
      const point = screenToCanvas(e.clientX, e.clientY);
      if (!point) return;
      currentStrokeRef.current.points.push(point);
      renderActiveStroke();
      return;
    }

    // Label gestures
    const gesture = gestureRef.current;
    if (gesture.mode === "drag" && gesture.pointerId === e.pointerId) {
      const pt = screenToCanvas(e.clientX, e.clientY);
      if (!pt) return;
      const newX = pt.x + gesture.offsetX;
      const newY = pt.y + gesture.offsetY;
      setLabels((prev) =>
        prev.map((l) =>
          l.id === gesture.labelId ? { ...l, x: newX, y: newY } : l
        )
      );
    } else if (gesture.mode === "pinch") {
      const pts = Array.from(pointersRef.current.values());
      if (pts.length < 2) return;
      const { dist, angle } = distAngle(pts[0], pts[1]);
      const scaleFactor = dist / gesture.startDist;
      const newScale = Math.max(0.3, Math.min(8, gesture.startScale * scaleFactor));
      const deltaAngle = angle - gesture.startAngle;
      const newRotation = gesture.startRotation + deltaAngle;
      setLabels((prev) =>
        prev.map((l) =>
          l.id === gesture.labelId
            ? { ...l, scale: newScale, rotation: newRotation }
            : l
        )
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);

    // Stroke finished
    if (currentStrokeRef.current) {
      historyRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = null;
      return;
    }

    // Gesture state machine
    const remaining = pointersRef.current.size;
    if (remaining === 0) {
      gestureRef.current = { mode: "none" };
    } else if (remaining === 1) {
      // Pinch → drag with the remaining finger
      const gesture = gestureRef.current;
      if (gesture.mode === "pinch") {
        const [pid, pos] = Array.from(pointersRef.current.entries())[0];
        const label = labels.find((l) => l.id === gesture.labelId);
        const pt = screenToCanvas(pos.x, pos.y);
        if (label && pt) {
          gestureRef.current = {
            mode: "drag",
            labelId: label.id,
            offsetX: label.x - pt.x,
            offsetY: label.y - pt.y,
            pointerId: pid,
          };
        }
      }
    }
  };

  const deleteLabel = (id: string) => {
    setLabels((prev) => prev.filter((l) => l.id !== id));
    setSelectedId(null);
  };

  const editLabel = (id: string) => {
    const label = labels.find((l) => l.id === id);
    if (!label) return;
    const input = window.prompt("Edit label:", label.text);
    if (input === null) return;
    const trimmed = input.trim();
    if (!trimmed) {
      deleteLabel(id);
      return;
    }
    setLabels((prev) =>
      prev.map((l) => (l.id === id ? { ...l, text: trimmed } : l))
    );
  };

  // ---- Export ----

  useImperativeHandle(
    ref,
    () => ({
      exportJpeg: (quality = 0.85) => {
        const size = sizeRef.current;
        const imageCanvas = imageCanvasRef.current;
        const markupCanvas = markupCanvasRef.current;
        if (!size || !imageCanvas || !markupCanvas) return imageDataUrl;
        const out = document.createElement("canvas");
        out.width = size.w;
        out.height = size.h;
        const ctx = out.getContext("2d");
        if (!ctx) return imageDataUrl;
        ctx.drawImage(imageCanvas, 0, 0);
        ctx.drawImage(markupCanvas, 0, 0);

        for (const label of labels) {
          ctx.save();
          ctx.translate(label.x, label.y);
          ctx.rotate(label.rotation);
          const fontSize = label.baseSize * label.scale;
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineJoin = "round";
          ctx.strokeStyle = "rgba(0,0,0,0.7)";
          ctx.lineWidth = Math.max(2, fontSize * 0.12);
          ctx.strokeText(label.text, 0, 0);
          ctx.fillStyle = label.color;
          ctx.fillText(label.text, 0, 0);
          ctx.restore();
        }
        return out.toDataURL("image/jpeg", quality);
      },
      getHistory: () => [...historyRef.current],
      setHistory: (actions) => {
        historyRef.current = [...(actions as Stroke[])];
        renderMarkup();
      },
    }),
    [imageDataUrl, labels, renderMarkup]
  );

  // ---- Render ----

  const layout = imageReady ? getCanvasLayout() : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={imageCanvasRef}
        className="absolute pointer-events-none"
        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
      />
      <canvas
        ref={markupCanvasRef}
        className="absolute pointer-events-none"
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          opacity: imageReady ? 1 : 0,
        }}
      />

      {/* Text labels — overlay, not interactive themselves (parent handles all gestures) */}
      {layout &&
        labels.map((label) => {
          const screenX = layout.offsetX + label.x * layout.scale;
          const screenY = layout.offsetY + label.y * layout.scale;
          const fontSizePx = label.baseSize * label.scale * layout.scale;
          const isSelected = label.id === selectedId;
          const containerRect = containerRef.current?.getBoundingClientRect();
          const relX = containerRect ? screenX - containerRect.left : screenX;
          const relY = containerRect ? screenY - containerRect.top : screenY;
          return (
            <div
              key={label.id}
              data-label-id={label.id}
              style={{
                position: "absolute",
                left: relX,
                top: relY,
                transform: `translate(-50%, -50%) rotate(${label.rotation}rad)`,
                pointerEvents: "auto",
                userSelect: "none",
                WebkitUserSelect: "none",
                padding: 12,
                zIndex: 10,
              }}
            >
              <div
                style={{
                  position: "relative",
                  padding: isSelected ? "4px 8px" : 0,
                  border: isSelected
                    ? "1px dashed rgba(255,255,255,0.9)"
                    : "none",
                  borderRadius: 6,
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    fontSize: fontSizePx,
                    fontWeight: 700,
                    color: label.color,
                    fontFamily: "sans-serif",
                    textShadow:
                      "0 0 3px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.85)",
                    lineHeight: 1,
                  }}
                >
                  {label.text}
                </span>

                {isSelected && (
                  <>
                    <button
                      data-label-button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLabel(label.id);
                      }}
                      style={{
                        position: "absolute",
                        top: -12,
                        left: -12,
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        background: "#ef4444",
                        color: "white",
                        border: "2px solid white",
                        fontSize: 13,
                        lineHeight: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        padding: 0,
                      }}
                      aria-label="Delete label"
                    >
                      ✕
                    </button>
                    <button
                      data-label-button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        editLabel(label.id);
                      }}
                      style={{
                        position: "absolute",
                        top: -12,
                        right: -12,
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        background: "#3b82f6",
                        color: "white",
                        border: "2px solid white",
                        fontSize: 12,
                        lineHeight: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        padding: 0,
                      }}
                      aria-label="Edit label"
                    >
                      ✎
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

      {/* Helper hint when a label is selected */}
      {selectedId && tool === "text" && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.7)",
            color: "white",
            fontSize: 12,
            padding: "6px 12px",
            borderRadius: 16,
            pointerEvents: "none",
            zIndex: 20,
          }}
        >
          Drag to move · pinch to resize/rotate · tap empty space to deselect
        </div>
      )}
    </div>
  );
});

export default MarkupCanvas;