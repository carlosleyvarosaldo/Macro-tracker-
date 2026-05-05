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

export type MarkupAction = Stroke | TextLabel;

const STROKE_COLOR = "#ff3b30";
const ERASE_MULTIPLIER = 3;
const TEXT_COLOR = "#ff3b30";
const TEXT_SIZE = 36;

export type MarkupCanvasHandle = {
  exportJpeg: (quality?: number) => string;
  /** Read the current action history (used when switching photos). */
  getHistory: () => MarkupAction[];
  /** Replace the current history (used when switching photos). */
  setHistory: (actions: MarkupAction[]) => void;
};

type Props = {
  imageDataUrl: string;
  tool: Tool;
  undoToken: number;
  strokeWidth: number;
  /** Bumped when parent wants to swap to a different image. */
  imageSwapToken?: number;
  /** History to load when imageSwapToken changes. */
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
  const historyRef = useRef<MarkupAction[]>(initialHistory ?? []);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const [imageReady, setImageReady] = useState(false);

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
      if (action.kind === "stroke") {
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
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      } else if (action.kind === "text") {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = action.color;
        ctx.font = `bold ${action.size}px sans-serif`;
        ctx.textBaseline = "top";
        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.lineWidth = 4;
        ctx.strokeText(action.text, action.x, action.y);
        ctx.fillText(action.text, action.x, action.y);
      }
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
    ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
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

  // Load image — runs whenever imageDataUrl changes (i.e. swap to new photo)
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

  // When parent signals a swap, load new history and re-render
  useEffect(() => {
    if (imageSwapToken === undefined) return;
    historyRef.current = initialHistory ?? [];
    renderMarkup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSwapToken]);

  useEffect(() => {
    if (undoToken === 0) return;
    if (historyRef.current.length === 0) return;
    historyRef.current.pop();
    renderMarkup();
  }, [undoToken, renderMarkup]);

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

    const stroke: Stroke = {
      kind: "stroke",
      points: [point],
      color: STROKE_COLOR,
      width: tool === "erase" ? strokeWidth * ERASE_MULTIPLIER : strokeWidth,
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
    historyRef.current.push(currentStrokeRef.current);
    currentStrokeRef.current = null;
  };

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
        return out.toDataURL("image/jpeg", quality);
      },
      getHistory: () => [...historyRef.current],
      setHistory: (actions) => {
        historyRef.current = [...actions];
        renderMarkup();
      },
    }),
    [imageDataUrl, renderMarkup]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden"
    >
      <canvas
        ref={imageCanvasRef}
        className="absolute pointer-events-none"
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
        }}
      />
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