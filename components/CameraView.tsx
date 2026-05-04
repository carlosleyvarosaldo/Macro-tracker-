"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { captureFrameAsJpeg } from "@/lib/image";
import { getCurrentLocation } from "@/lib/location";
import { ScopeSelector } from "@/components/ScopeSelector";
import { Tree } from "@/types";

type Mode = "live" | "preview" | "details";
type SaveStage = "idle" | "locating" | "saving";

type LensOption = {
  deviceId: string;
  label: string;     // What we display to user, e.g. "0.5x", "1x", "3x"
};

type Props = {
  isActive: boolean;
};

/**
 * Heuristic to label rear cameras based on their device labels.
 * Returns null if the camera doesn't appear to be a useful rear camera.
 */
function classifyRearCamera(label: string): string | null {
  const l = label.toLowerCase();
  // Filter out front cameras
  if (l.includes("front") || l.includes("user") || l.includes("face")) return null;
  if (l.includes("ultra") || l.includes("wide") && !l.includes("zoom")) return "0.5x";
  if (l.includes("tele") || l.includes("zoom") || /\b[3-9]x\b/.test(l)) return "3x";
  return "1x";
}

export default function CameraView({ isActive }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<Mode>("live");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scopeItems, setScopeItems] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveStage, setSaveStage] = useState<SaveStage>("idle");
  const [toast, setToast] = useState<string | null>(null);
  const [lenses, setLenses] = useState<LensOption[]>([]);
  const [activeLensId, setActiveLensId] = useState<string | null>(null);

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

  // Enumerate available cameras after we have permission
  const enumerateLenses = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");

      // Map each rear camera to a labeled lens option
      const seen = new Set<string>();
      const result: LensOption[] = [];
      for (const d of videoInputs) {
        const label = classifyRearCamera(d.label || "");
        if (!label) continue;
        // Avoid duplicate labels (some phones expose 1x camera twice)
        if (seen.has(label)) continue;
        seen.add(label);
        result.push({ deviceId: d.deviceId, label });
      }

      // Sort: 0.5x, 1x, 3x
      const order: Record<string, number> = { "0.5x": 0, "1x": 1, "3x": 2 };
      result.sort((a, b) => (order[a.label] ?? 99) - (order[b.label] ?? 99));

      setLenses(result);
    } catch {
      setLenses([]);
    }
  }, []);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      try {
        setError(null);

        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? {
                deviceId: { exact: deviceId },
                width: { ideal: 3840 },
                height: { ideal: 2160 },
              }
            : {
                facingMode: "environment",
                width: { ideal: 3840 },
                height: { ideal: 2160 },
              },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
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

        // After first successful permission grant, labels are populated
        if (lenses.length === 0) {
          await enumerateLenses();
        }

        // Track the active deviceId so the UI can highlight it
        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings();
        if (settings?.deviceId) {
          setActiveLensId(settings.deviceId);
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
    },
    [lenses.length, enumerateLenses]
  );

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Lifecycle: start camera when active+live, stop otherwise
  useEffect(() => {
    if (isActive && mode === "live") {
      startCamera(activeLensId ?? undefined);
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // We intentionally exclude `activeLensId` from deps to avoid restarting on every change;
    // the user-driven switch path handles that explicitly via handleSwitchLens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, mode]);

  const handleSwitchLens = async (deviceId: string) => {
    if (deviceId === activeLensId) return;
    stopCamera();
    setActiveLensId(deviceId);
    await startCamera(deviceId);
  };

  const waitForVideoReady = (
    video: HTMLVideoElement,
    timeoutMs = 3000
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const isReady = () =>
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        video.readyState >= 2 &&
        !video.paused;

      if (isReady()) {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        return;
      }

      const start = Date.now();
      const interval = setInterval(() => {
        if (isReady()) {
          clearInterval(interval);
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
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
          // eslint-disable-next-line @next/next/no-img-element
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
        )}

        {/* Lens picker — only shown in live mode and when 2+ lenses are available */}
        {mode === "live" && lenses.length >= 2 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/40 backdrop-blur-sm rounded-full px-2 py-1.5 z-10">
            {lenses.map((lens) => (
              <button
                key={lens.deviceId}
                onClick={() => handleSwitchLens(lens.deviceId)}
                className={`rounded-full text-xs font-semibold transition-colors ${
                  lens.deviceId === activeLensId
                    ? "bg-white text-black w-10 h-10"
                    : "bg-transparent text-white w-9 h-9 active:bg-white/20"
                }`}
              >
                {lens.label}
              </button>
            ))}
          </div>
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