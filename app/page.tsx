"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { captureFrameAsJpeg } from "@/lib/image";
import { getCurrentLocation } from "@/lib/location";
import { ScopeSelector } from "@/components/ScopeSelector";
import { Tree } from "@/types";

type Mode = "live" | "preview" | "details";
type SaveStage = "idle" | "locating" | "saving";

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<Mode>("live");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scopeItems, setScopeItems] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveStage, setSaveStage] = useState<SaveStage>("idle");
  const [toast, setToast] = useState<string | null>(null);

  const {
    activeEstimateId,
    createEstimate,
    addTreeToEstimate,
    loadEstimates,
  } = useAppStore();

  useEffect(() => {
    loadEstimates();
  }, [loadEstimates]);

  // Auto-clear toast after 3s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

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
        await videoRef.current.play().catch(() => {});
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
    if (mode === "live") startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [mode, startCamera, stopCamera]);

  const handleCapture = () => {
    if (!videoRef.current) return;
    try {
 const dataUrl = captureFrameAsJpeg(videoRef.current, 2560, 0.9);
      setCapturedImage(dataUrl);
      setMode("preview");
    } catch {
      setError("Capture failed. Try again.");
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setScopeItems([]);
    setMode("live");
  };

  const handleProceedToDetails = () => setMode("details");

  const handleSaveTree = async () => {
    if (!capturedImage || saveStage !== "idle") return;

    setSaveStage("locating");

    // 1. Best-effort location fetch (never throws, max 5s)
    const locResult = await getCurrentLocation();
    const coords = locResult.ok
      ? locResult.coords
      : { lat: 0, lng: 0 };

    setSaveStage("saving");

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
        scopeItems,
        notes: "",
        lat: coords.lat,
        lng: coords.lng,
        createdAt: Date.now(),
      };

      await addTreeToEstimate(tree);

      // 2. Tell the user if location failed (but the tree still saved)
      if (!locResult.ok) {
        setToast("Location unavailable – saved without location");
      }

      setCapturedImage(null);
      setScopeItems([]);
      setMode("live");
    } catch {
      setError("Could not save tree.");
    } finally {
      setSaveStage("idle");
    }
  };

  // --- Error fallback ---
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

  const isWorking = saveStage !== "idle";
  const saveLabel =
    saveStage === "locating"
      ? "Getting location..."
      : saveStage === "saving"
      ? "Saving..."
      : "Save Tree";

  // --- Details mode (scope selection + save) ---
  if (mode === "details" && capturedImage) {
    return (
      <div className="flex min-h-screen flex-col bg-white pb-16">
        <div className="px-4 pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={capturedImage}
            alt="Captured tree"
            className="w-full h-40 object-cover rounded-lg bg-gray-100"
          />
        </div>

        <div className="px-4 py-4 flex-1">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Scope of Work
          </h2>
          <ScopeSelector selected={scopeItems} onChange={setScopeItems} />
        </div>

        <div className="px-4 py-4 bg-white border-t border-gray-200 flex gap-3">
          <button
            onClick={handleRetake}
            disabled={isWorking}
            className="flex-1 rounded-xl bg-gray-200 py-4 text-gray-800 font-semibold active:bg-gray-300 disabled:opacity-50"
          >
            Retake
          </button>
          <button
            onClick={handleSaveTree}
            disabled={isWorking}
            className="flex-1 rounded-xl bg-emerald-600 py-4 text-white font-semibold active:bg-emerald-700 disabled:opacity-50"
          >
            {saveLabel}
          </button>
        </div>

        {toast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 max-w-[90%] rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg z-20">
            {toast}
          </div>
        )}
      </div>
    );
  }

  // --- Live + preview modes ---
  return (
    <div className="flex min-h-screen flex-col bg-black pb-16">
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
              className="flex-1 rounded-xl bg-gray-700 py-4 text-white font-semibold active:bg-gray-600"
            >
              Retake
            </button>
            <button
              onClick={handleProceedToDetails}
              className="flex-1 rounded-xl bg-emerald-600 py-4 text-white font-semibold active:bg-emerald-700"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 max-w-[90%] rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg z-20">
          {toast}
        </div>
      )}
    </div>
  );
}