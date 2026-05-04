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
  kind: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
};

type Action = Stroke | TextLabel;

const STROKE_COLOR = "#ff3b30"; // bright red — visible on bark, leaves, sky
const STROKE_WIDTH = 6;
const ERASE_WIDTH = 28;
const TEXT_COLOR = "#ff3b30";
const TEXT_SIZE = 28;

export type MarkupCanvasHandle = {
  /** Returns a JPEG data URL combining background + markup. */
  exportJpeg: (quality?: number) => string;
};

type Props = {
  imageDataUrl: string;
  tool: Tool;
  /** Bumping this number triggers an undo of the most recent action. */
  undoToken: number;
};

const MarkupCanvas = forwardRef<MarkupCanvasHandle, Props>(function MarkupCanvas(
  { imageDataUrl, tool, undoToken },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const markupCanvasRef = useRef<HTMLCanvasElement>(null);

  // Internal canvas pixel size — set once after image loads
  const sizeRef = useRef<{ w: number; h: number } | null>(null);

  // Action history (stack); undo pops the latest
  const historyRef = useRef<Action[]>([]);

  // Active stroke being drawn right now
  const currentStrokeRef = useRef<Stroke | null>(null);

  const [imageReady, setImageReady] = useState(false);

  // Render the image once when it loads or canvas resizes
  const renderImage = useCallback((img: HTMLImageElement) => {
    const canvas = imageCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }, []);

  // Re-rasterize the markup layer from history
  const renderMarkup = useCallback(() => {
    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const action of historyRef.current) {
      if (action.kind === "stroke") {
        ctx.globalCompositeOperation = action.erase
          ? "destination-out"
          : "source-over";
        ctx.strokeStyle = action.color;
        ctx.lineWidth = action.width;

        const pts = action.points;
        if (pts.length === 0) continue;
        if (pts.length === 1) {
          // Single tap — draw a small dot
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, action.width / 2, 0, Math.PI * 2);
          ctx.fillStyle = action.color;
          ctx.fill();
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      } else if (action.kind === "text") {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = action.color;
        ctx.font = `bold ${action.size}px sans-serif`;
        ctx.textBaseline = "top";

        // Outline for legibility against any background
        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.lineWidth = 4;
        ctx.strokeText(action.text, action.x, action.y);
        ctx.fillText(action.text, action.x, action.y);
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }, []);

  // Draw just the active in-progress stroke incrementally (skip full re-render)
  const renderActiveStroke = useCallback(() => {
    const canvas = markupCanvasRef.current;
    const stroke = currentStrokeRef.current;
    if (!canvas || !stroke || stroke.points.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const a = stroke.points[stroke.points.length - 2];
    const b = stroke.points[stroke.points.length - 1];

    ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }, []);

  // Load image and size both canvases to match its native dimensions
  useEffect(() => {
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

  // Undo handler
  useEffect(() => {
    if (undoToken === 0) return;
    if (historyRef.current.length === 0) return;
    historyRef.current.pop();
    renderMarkup();
  }, [undoToken, renderMarkup]);

  // Translate a pointer event's clientX/Y into canvas pixel coordinates
  const eventToCanvasCoords = (
    e: React.PointerEvent<HTMLCanvasElement>
  ): StrokePoint => {
    const canvas = markupCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const point = eventToCanvasCoords(e);

    if (tool === "text") {
      const input = window.prompt("Add a label:");
      if (!input || !input.trim()) return;
      const label: TextLabel = {
        kind: "text",
        x: point.x,
        y: point.y,
        text: input.trim(),
        color: TEXT_COLOR,
        size: TEXT_SIZE,
      };
      historyRef.current.push(label);
      renderMarkup();
      return;
    }

    // Start a stroke (draw or erase)
    const stroke: Stroke = {
      kind: "stroke",
      points: [point],
      color: STROKE_COLOR,
      width: tool === "erase" ? ERASE_WIDTH : STROKE_WIDTH,
      erase: tool === "erase",
    };
    currentStrokeRef.current = stroke;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!currentStrokeRef.current) return;
    e.preventDefault();
    const point = eventToCanvasCoords(e);
    currentStrokeRef.current.points.push(point);
    renderActiveStroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!currentStrokeRef.current) return;
    const canvas = markupCanvasRef.current;
    canvas?.releasePointerCapture(e.pointerId);

    // Persist the completed stroke into history
    historyRef.current.push(currentStrokeRef.current);
    currentStrokeRef.current = null;
  };

  // Expose export() to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      exportJpeg: (quality = 0.85) => {
        const size = sizeRef.current;
        const imageCanvas = imageCanvasRef.current;
        const markupCanvas = markupCanvasRef.current;
        if (!size || !imageCanvas || !markupCanvas) return imageDataUrl;

        // Composite both canvases into one
        const out = document.createElement("canvas");
        out.width = size.w;
        out.height = size.h;
        const ctx = out.getContext("2d");
        if (!ctx) return imageDataUrl;

        ctx.drawImage(imageCanvas, 0, 0);
        ctx.drawImage(markupCanvas, 0, 0);
        return out.toDataURL("image/jpeg", quality);
      },
    }),
    [imageDataUrl]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden"
    >
      {/* Background image canvas */}
      <canvas
        ref={imageCanvasRef}
        className="absolute pointer-events-none"
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
        }}
      />
      {/* Markup canvas — captures pointer events */}
      <canvas
        ref={markupCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute touch-none"
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          cursor: tool === "text" ? "text" : "crosshair",
          opacity: imageReady ? 1 : 0,
        }}
      />
    </div>
  );
});

export default MarkupCanvas;