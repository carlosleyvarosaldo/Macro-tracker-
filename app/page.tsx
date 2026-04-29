"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { captureFrameAsJpeg } from "@/lib/image";
import { Tree } from "@/types";

type Mode = "live" | "preview";

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<Mode>("live");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    activeEstimateId,
    createEstimate,
    addTreeToEstimate,
    loadEstimates,
  } = useAppStore();

  // Hydrate estimates list once on mount.
  useEffect(() => {
    loadEstimates();
  }, [loadEstimates]);

  // Start camera when in live mode; stop on unmount or mode change.
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {
          /* autoplay may be blocked; user gesture will resolve */
        });
      }
    } catch (err) {
      const name = (err as Error).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Camera permission denied. Enable it in your browser settings.");
      } else if (name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError("Could not start camera.");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (mode === "live") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, startCamera, stopCamera]);

  // Capture
  const handleCapture = () => {
    if (!videoRef.current) return;
    try {
      const dataUrl = captureFrameAsJpeg(videoRef.current, 1200, 0.7);
      setCapturedImage(dataUrl);
      setMode("preview");
    } catch {
      setError("Capture failed. Try again.");
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setMode("live");
  };

  // Save tree, creating an estimate first if none is active.
  const handleSaveTree = async () => {
    if (!capturedImage || saving) return;
    setSaving(true);
    try {
      let estimateId = activeEstimateId;
      if (!estimateId) {
        const created = await createEstimate();
        estimateId = created.id;
      }

      const tree: Tree = {
        id: crypto.randomUUID(),
        estimateId,
        image: capturedImage,
        price: 0,
        scopeCount: 0,
        notes: "",
        lat: 0,
        lng: 0,
        createdAt: Date.now(),
      };

      await addTreeToEstimate(tree);
      setCapturedImage(null);
      setMode("live");
    } catch {
      setError("Could not save tree.");
    } finally {
      setSaving(false);
    }
  };

  // --- Render ---

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 pb-16 text-center">
        <p className="text-gray-700 mb-4">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setMode("live");
          }}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-white text-sm font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black pb-16">
      {/* Viewport: live camera or captured preview */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {mode === "live" && (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {mode === "preview" && capturedImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={capturedImage}
            alt="Captured tree"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </div>

      {/* Controls */}
      <div className="bg-black px-6 py-6 space-y-3">
        {activeEstimateId && (
          <p className="text-center text-xs text-gray-400">
            Active estimate: {activeEstimateId.slice(0, 8)}
          </p>
        )}

        {mode === "live" && (
          <button
            onClick={handleCapture}
            className="w-full rounded-xl bg-white py-4 text-black font-semibold active:bg-gray-200"
          >
            Capture
          </button>
        )}

        {mode === "preview" && (
          <div className="flex gap-3">
            <button
              onClick={handleRetake}
              disabled={saving}
              className="flex-1 rounded-xl bg-gray-700 py-4 text-white font-semibold active:bg-gray-600 disabled:opacity-50"
            >
              Retake
            </button>
            <button
              onClick={handleSaveTree}
              disabled={saving}
              className="flex-1 rounded-xl bg-emerald-600 py-4 text-white font-semibold active:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Tree"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
