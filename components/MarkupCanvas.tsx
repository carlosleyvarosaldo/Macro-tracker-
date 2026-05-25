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

/** Text labels are interactive overlay objects, NOT baked into the canvas until export. */
type TextLabel = {
  id: string;
  text: string;
  /** Position in CANVAS coordinates (the label's center). */
  x: number;
  y: number;
  /** Font size in canvas pixels at scale 1. */
  baseSize: number;
  scale: number;
  /** Rotation in radians. */
  rotation: number;
  color: string;
};

export type MarkupAction = Stroke;

const STROKE_COLOR = "#ff3b30";
const ERASE_MULTIPLIER = 3;
const TEXT_COLOR = "#ff3b30";
const TEXT_BASE_SIZE = 48;

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

type GestureState =
  | { mode: "none" }
  | {
      mode: "drag";
      labelId: string;
      // offset from pointer to label center, in canvas coords
      offsetX: number;
      offsetY: number;
      pointerId: number;
      moved: boolean;
    }
  | {
      mode: "pinch";
      labelId: string;
      startDist: number;
      startAngle: number;
      startScale: number;
      startRotation: number;
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

  // Text labels live in React state since they render as overlay DOM
  const [labels, setLabels] = useState<TextLabel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);

  // Track active pointers for multi-touch gestures
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<GestureState>({ mode: "none" });

  // ---- Canvas rendering (image + strokes only; text is overlay) ----

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

  // Handle image swap (multi-photo) — reset strokes + text
  useEffect(() => {
    if (imageSwapToken === undefined) return;
    historyRef.current = (initialHistory as Stroke[]) ?? [];
    setLabels([]);
    setSelectedId(null);
    renderMarkup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSwapToken]);

  // Undo — pops the most recent action (stroke OR text, whichever is newer)
  useEffect(() => {
    if (undoToken === 0) return;
    // Prefer undoing the most recently added thing. We track this simply:
    // if there are labels and the last action was a label, remove it; else pop a stroke.
    // For simplicity: remove last label if any were added after last stroke.
    // We keep a combined approach: try labels first if selected, else newest label, else stroke.
    setLabels((prev) => {
      if (prev.length > 0) {
        const next = prev.slice(0, -1);
        return next;
      }
      // No labels — undo a stroke
      if (historyRef.current.length > 0) {
        historyRef.current.pop();
        renderMarkup();
      }
      return prev;
    });
  }, [undoToken, renderMarkup]);

  // ---- Coordinate helpers ----

  /** Get the on-screen rect of the canvas content (accounting for object-fit: contain). */
  const getCanvasLayout = useCallback(() => {
    const canvas = markupCanvasRef.current;
    const container = containerRef.current;
    const size = sizeRef.current;
    if (!canvas || !container || !size) return null;
    const cRect = container.getBoundingClientRect();
    // object-fit: contain — compute displayed image rect inside container
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

  // ---- Stroke drawing (draw/erase tools) ----

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Only handle strokes when in draw/erase mode
    if (tool === "text") {
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
      return;
    }

    e.preventDefault();
    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
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
    // Deselect any text when drawing
    setSelectedId(null);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!currentStrokeRef.current) return;
    e.preventDefault();
    const point = screenToCanvas(e.clientX, e.clientY);
    if (!point) return;
    currentStrokeRef.current.points.push(point);
    renderActiveStroke();
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!currentStrokeRef.current) return;
    markupCanvasRef.current?.releasePointerCapture(e.pointerId);
    historyRef.current.push(currentStrokeRef.current);
    currentStrokeRef.current = null;
  };

  // ---- Text label gestures (drag / pinch-rotate) ----

  const distAngle = (
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return {
      dist: Math.hypot(dx, dy),
      angle: Math.atan2(dy, dx),
    };
  };

  const handleLabelPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    label: TextLabel
  ) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setSelectedId(label.id);

    const activePointers = Array.from(pointersRef.current.entries());

    if (activePointers.length === 1) {
      // Begin drag
      const canvasPt = screenToCanvas(e.clientX, e.clientY);
      if (!canvasPt) return;
      gestureRef.current = {
        mode: "drag",
        labelId: label.id,
        offsetX: label.x - canvasPt.x,
        offsetY: label.y - canvasPt.y,
        pointerId: e.pointerId,
        moved: false,
      };
    } else if (activePointers.length === 2) {
      // Begin pinch — use the two active pointers
      const [, p1] = activePointers[0];
      const [, p2] = activePointers[1];
      const { dist, angle } = distAngle(p1, p2);
      gestureRef.current = {
        mode: "pinch",
        labelId: label.id,
        startDist: dist || 1,
        startAngle: angle,
        startScale: label.scale,
        startRotation: label.rotation,
      };
    }
  };

  const handleLabelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    e.stopPropagation();
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const gesture = gestureRef.current;

    if (gesture.mode === "drag" && gesture.pointerId === e.pointerId) {
      const canvasPt = screenToCanvas(e.clientX, e.clientY);
      if (!canvasPt) return;
      const newX = canvasPt.x + gesture.offsetX;
      const newY = canvasPt.y + gesture.offsetY;
      gestureRef.current = { ...gesture, moved: true };
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
      const newScale = Math.max(0.3, Math.min(6, gesture.startScale * scaleFactor));
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

  const handleLabelPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    pointersRef.current.delete(e.pointerId);
    const remaining = pointersRef.current.size;
    if (remaining === 0) {
      gestureRef.current = { mode: "none" };
    } else if (remaining === 1) {
      // Dropped from pinch to single finger — switch to drag with the remaining finger
      const [pid, pos] = Array.from(pointersRef.current.entries())[0];
      const gesture = gestureRef.current;
      if (gesture.mode === "pinch") {
        const label = labels.find((l) => l.id === gesture.labelId);
        const canvasPt = screenToCanvas(pos.x, pos.y);
        if (label && canvasPt) {
          gestureRef.current = {
            mode: "drag",
            labelId: label.id,
            offsetX: label.x - canvasPt.x,
            offsetY: label.y - canvasPt.y,
            pointerId: pid,
            moved: true,
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

  // ---- Export: paint image + strokes + text into one JPEG ----

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

        // Paint each text label at its transform
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
    >
      <canvas
        ref={imageCanvasRef}
        className="absolute pointer-events-none"
        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
      />
      <canvas
        ref={markupCanvasRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        className="absolute touch-none"
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          cursor: tool === "text" ? "text" : "crosshair",
          opacity: imageReady ? 1 : 0,
        }}
      />

      {/* Text label overlays */}
      {layout &&
        labels.map((label) => {
          const screenX = layout.offsetX + label.x * layout.scale;
          const screenY = layout.offsetY + label.y * layout.scale;
          const fontSizePx = label.baseSize * label.scale * layout.scale;
          const isSelected = label.id === selectedId;
          // position relative to container
          const containerRect = containerRef.current?.getBoundingClientRect();
          const relX = containerRect ? screenX - containerRect.left : screenX;
          const relY = containerRect ? screenY - containerRect.top : screenY;
          return (
            <div
              key={label.id}
              onPointerDown={(e) => handleLabelPointerDown(e, label)}
              onPointerMove={handleLabelPointerMove}
              onPointerUp={handleLabelPointerUp}
              onPointerCancel={handleLabelPointerUp}
              style={{
                position: "absolute",
                left: relX,
                top: relY,
                transform: `translate(-50%, -50%) rotate(${label.rotation}rad)`,
                touchAction: "none",
                cursor: "move",
                userSelect: "none",
                WebkitUserSelect: "none",
              }}
            >
              <div
                style={{
                  position: "relative",
                  padding: isSelected ? "4px 8px" : "0",
                  border: isSelected
                    ? "1px dashed rgba(255,255,255,0.8)"
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
                      "0 0 3px rgba(0,0,0,0.8), 0 0 3px rgba(0,0,0,0.8)",
                    lineHeight: 1,
                  }}
                >
                  {label.text}
                </span>

                {isSelected && (
                  <>
                    {/* Delete button — top-left */}
                    <button
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLabel(label.id);
                      }}
                      style={{
                        position: "absolute",
                        top: -10,
                        left: -10,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        background: "#ef4444",
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
                      aria-label="Delete label"
                    >
                      ✕
                    </button>
                    {/* Edit button — top-right */}
                    <button
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        editLabel(label.id);
                      }}
                      style={{
                        position: "absolute",
                        top: -10,
                        right: -10,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        background: "#3b82f6",
                        color: "white",
                        border: "2px solid white",
                        fontSize: 11,
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
    </div>
  );
});

export default MarkupCanvas;