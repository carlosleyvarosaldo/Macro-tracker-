"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { captureFrameAsJpeg } from "@/lib/image";
import { getCurrentLocation } from "@/lib/location";
import { ScopeSelector } from "@/components/ScopeSelector";
import { Tree } from "@/types";

type Mode = "live" | "preview" | "details";
type SaveStage = "idle" | "locating" | "saving";

type Props = {
  /** Whether this view is currently visible. Camera stream only runs when true. */
  isActive: boolean;
};

export default function CameraView({ isActive }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<Mode>("live");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scopeItems, setScopeItems] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveStage, setSaveStage] = useState<SaveStage>("idle");
  const [toast, setToast] = useState<string | null>(null);

  const { activeEstimateId, createEstimate, addTreeToEstimate, loadEstimates } =
    useAppStore();

  useEffect(() => {
    loadEstimates();
  }, [loadEstimates]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for first frame's metadata before continuing.
        // This makes videoWidth/videoHeight populated by the time the user can tap Capture.
        await new Promise<void>((resolve) => {
          const v = videoRef.current!;
          if (v.readyState >= 2) {
            resolve();
            return;
          }
          const onReady = () => {
            v.removeEventListener("loadedmetadata", onReady);
            resolve();
          };
          v.addEventListener("loadedmetadata", onReady);
        });
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      const name = (err as Error).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Camera permission denied.");
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

  // Camera stream tied to BOTH visibility (isActive) AND mode
  useEffect(() => {
    if (isActive && mode === "live") startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [isActive, mode, startCamera, stopCamera]);

  const waitForVideoReady = (
    video: HTMLVideoElement,
    timeoutMs = 2000
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        resolve();
        return;
      }
      const start = Date.now();
      const interval = setInterval(() => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          reject(new Error("Camera not ready — try again"));
        }
      }, 50);
    });
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;
    try {
      await waitForVideoReady(videoRef.current);
      const dataUrl = captureFrameAsJpeg(videoRef.current, 1920, 0.85);
      setCapturedImage(dataUrl);
      setMode("preview");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      setError(`Capture failed: ${msg}`);
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
    const locResult = await getCurrentLocation();
    const coords = locResult.ok ? locResult.coords : { lat: 0, lng: 0 };
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

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center bg-black text-white">
        <p className="mb-4">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setMode("live");
          }}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium"
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

  if (mode === "details" && capturedImage) {
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="px-4 pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={capturedImage}
            alt="Captured tree"
            className="w-full h-40 object-cover rounded-lg bg-gray-100"
          />
        </div>
        <div className="px-4 py-4 flex-1 overflow-y-auto">
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
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 max-w-[90%] rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg z-20">
            {toast}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-black" style={{ height: "100vh" }}>
      <div
        className="relative overflow-hidden"
        style={{ flex: "1 1 0", minHeight: 0 }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: mode === "live" ? "block" : "none",
          }}
        />
        {mode === "preview" && capturedImage && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capturedImage}
              alt="Captured tree"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                backgroundColor: "red",
                color: "white",
                fontSize: 12,
                padding: "4px 8px",
                zIndex: 50,
              }}
            >
              Preview | bytes: {capturedImage.length}
            </div>
          </>
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
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 max-w-[90%] rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg z-20">
          {toast}
        </div>
      )}
    </div>
  );
}