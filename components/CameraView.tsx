"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { captureFrameAsJpeg, processImageFile } from "@/lib/image";
import { getCurrentLocation } from "@/lib/location";
import { reverseGeocode } from "@/lib/geocoding";
import { ScopeSelector } from "@/components/ScopeSelector";
import MarkupCanvas, { MarkupCanvasHandle, MarkupAction } from "@/components/MarkupCanvas";
import { Tree } from "@/types";

type Mode = "live" | "preview" | "markup" | "details";
type SaveStage = "idle" | "locating" | "saving";
type MarkupTool = "draw" | "erase" | "text";


type Props = {
  isActive: boolean;
  onSwipeLockChange?: (locked: boolean) => void;
};



export default function CameraView({ isActive, onSwipeLockChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const markupRef = useRef<MarkupCanvasHandle>(null);

  const [mode, setMode] = useState<Mode>("live");
  // images[0] = primary (markup target); rest are additional photos
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [scopeItems, setScopeItems] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveStage, setSaveStage] = useState<SaveStage>("idle");
  const [toast, setToast] = useState<string | null>(null);

  const [zoomCapability, setZoomCapability] = useState<{
    min: number;
    max: number;
    step: number;
  } | null>(null);
  const [activeZoom, setActiveZoom] = useState<number>(1);

const [markupTool, setMarkupTool] = useState<MarkupTool>("draw");
  const [strokeWidth, setStrokeWidth] = useState<number>(12);
  const [undoToken, setUndoToken] = useState(0);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [imageSwapToken, setImageSwapToken] = useState<number>(0);
  const photoHistoriesRef = useRef<MarkupAction[][]>([]);
  const { activeEstimateId, createEstimate, addTreeToEstimate, loadEstimates, updateEstimate } =
    useAppStore();

  useEffect(() => {
    loadEstimates();
  }, [loadEstimates]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    onSwipeLockChange?.(mode === "markup" || mode === "details");
  }, [mode, onSwipeLockChange]);

  

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 3840 },
          height: { ideal: 2160 },
        },
        audio: false,
      });
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

      // Detect zoom capabilities — iOS Safari supports this on 11 Pro+
      const track = stream.getVideoTracks()[0];
      // Use the standard MediaTrackCapabilities API; some browsers expose `zoom`
      type ZoomCap = { min?: number; max?: number; step?: number };
      const caps =
        (track?.getCapabilities?.() as MediaTrackCapabilities & {
          zoom?: ZoomCap;
        }) ?? {};
      const zoomCap = caps.zoom;
      if (
        zoomCap &&
        typeof zoomCap.min === "number" &&
        typeof zoomCap.max === "number" &&
        zoomCap.max > zoomCap.min
      ) {
        setZoomCapability({
          min: zoomCap.min,
          max: zoomCap.max,
          step: zoomCap.step ?? 0.1,
        });
        setActiveZoom(Math.max(1, zoomCap.min));
        // Apply the starting zoom
        try {
          await track.applyConstraints({
            advanced: [
              { zoom: Math.max(1, zoomCap.min) } as MediaTrackConstraintSet & {
                zoom: number;
              },
            ],
          });
        } catch {
          // ignore
        }
      } else {
        setZoomCapability(null);
        setActiveZoom(1);
      }
      setActiveZoom(1);
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

  useEffect(() => {
    if (isActive && mode === "live") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, mode]);

  const applyZoom = async (zoom: number) => {
    const stream = streamRef.current;
    const track = stream?.getVideoTracks()[0];
    if (!track || !zoomCapability) return;
    // Clamp to capabilities
    const clamped = Math.max(
      zoomCapability.min,
      Math.min(zoomCapability.max, zoom)
    );
    try {
      await track.applyConstraints({
        // The DOM types don't include `zoom` yet on all targets; cast.
        advanced: [{ zoom: clamped } as MediaTrackConstraintSet & { zoom: number }],
      });
      setActiveZoom(clamped);
    } catch {
      // Some devices may not allow constraint changes; fail silently
    }
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
      setCapturedImages((prev) => [...prev, dataUrl]);
      setMode("preview");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      setError(`Capture failed: ${msg}`);
    }
  };

  const handleGalleryClick = () => fileInputRef.current?.click();

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await processImageFile(file, 1920, 0.85);
      setCapturedImages((prev) => [...prev, dataUrl]);
      setMode("preview");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      setError(`Could not load photo: ${msg}`);
    }
  };

  const handleAddAnother = () => {
    setMode("live");
  };

  const handleRetake = () => {
    // Remove the most recent photo (allows re-doing just the latest shot)
    setCapturedImages((prev) => prev.slice(0, -1));
    setMode(capturedImages.length > 1 ? "preview" : "live");
  };

  const handleStartOver = () => {
    setCapturedImages([]);
    setScopeItems([]);
    setMode("live");
  };

  const handleProceedToMarkup = () => {
    setMarkupTool("draw");
    // Initialize per-photo histories — empty arrays, one per image
    photoHistoriesRef.current = capturedImages.map(() => []);
    setActivePhotoIndex(0);
    setMode("markup");
  };

  const handleSkipMarkup = () => setMode("details");

  /** Persist current canvas history before switching photos. */
  const persistCurrentHistory = () => {
    if (!markupRef.current) return;
    photoHistoriesRef.current[activePhotoIndex] = markupRef.current.getHistory();
  };

  const handleSwitchPhoto = (newIndex: number) => {
    if (newIndex === activePhotoIndex) return;
    if (newIndex < 0 || newIndex >= capturedImages.length) return;
    persistCurrentHistory();
    // Flatten current photo so its markup is preserved in capturedImages
    if (markupRef.current) {
      const flattened = markupRef.current.exportJpeg(0.85);
      setCapturedImages((prev) => {
        const next = [...prev];
        next[activePhotoIndex] = flattened;
        return next;
      });
    }
    setActivePhotoIndex(newIndex);
    setImageSwapToken((n) => n + 1);
  };

  const handleApplyMarkup = () => {
    // Flatten the photo currently being edited
    if (markupRef.current) {
      const flattened = markupRef.current.exportJpeg(0.85);
      setCapturedImages((prev) => {
        const next = [...prev];
        next[activePhotoIndex] = flattened;
        return next;
      });
    }
    setMode("details");
  };

  const handleSaveTree = async () => {
    if (capturedImages.length === 0 || saveStage !== "idle") return;
    setSaveStage("locating");
    const locResult = await getCurrentLocation();
    const coords = locResult.ok
      ? locResult.coords
      : { lat: 0, lng: 0, accuracy: 0 };
    setSaveStage("saving");

    try {
      let estimateId = activeEstimateId;
      let isFirstTreeOfNewEstimate = false;
      if (!estimateId) {
        const created = await createEstimate();
        estimateId = created.id;
        isFirstTreeOfNewEstimate = true;
      }

      const tree: Tree = {
        id: crypto.randomUUID(),
        estimateId,
        images: capturedImages,
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
      } else if (locResult.coords.accuracy > 25) {
        setToast(`Saved (low accuracy: ±${Math.round(locResult.coords.accuracy)}m)`);
      }

      // Geocode whenever the estimate doesn't already have an address —
      // works for fresh estimates AND for blank estimates the user pre-created
      const targetEstimate = useAppStore
        .getState()
        .estimates.find((e) => e.id === estimateId);
      const needsAddress = !targetEstimate?.address;

      if (needsAddress && locResult.ok) {
        const idForGeocode = estimateId;
        const hasManualName = !!targetEstimate?.name?.trim();
        reverseGeocode(coords.lat, coords.lng)
          .then((address) => {
            if (!address) return;
            // Always store the address; only override `name` if the user
            // hasn't already given the estimate a manual label.
            const changes = hasManualName
              ? { address }
              : { address, name: address };
            updateEstimate(idForGeocode, changes);
          })
          .catch(() => {});
      }

      setCapturedImages([]);
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

  // --- Markup mode ---
  if (mode === "markup" && capturedImages[activePhotoIndex]) {
    const isMultiPhoto = capturedImages.length > 1;
    return (
      <div className="flex flex-col bg-black" style={{ height: "100vh" }}>
        <div className="flex justify-between items-center px-3 py-2 bg-black/70 backdrop-blur-sm">
          <button
            onClick={() => setMode("preview")}
            className="text-white text-sm font-medium px-3 py-1.5 rounded-lg active:bg-white/10"
          >
            Back
          </button>
          <p className="text-white text-xs opacity-70">
            {isMultiPhoto
              ? `Markup · Photo ${activePhotoIndex + 1} of ${capturedImages.length}`
              : "Markup"}
          </p>
          <button
            onClick={handleSkipMarkup}
            className="text-white text-sm font-medium px-3 py-1.5 rounded-lg active:bg-white/10"
          >
            Skip
          </button>
        </div>

        {/* Photo switcher — only when multiple photos */}
        {isMultiPhoto && (
          <div className="bg-black/70 backdrop-blur-sm px-3 py-2 border-b border-white/10">
            <div className="flex gap-2 overflow-x-auto">
              {capturedImages.map((src, i) => (
                <button
                  key={i}
                  onClick={() => handleSwitchPhoto(i)}
                  className={`relative flex-shrink-0 rounded-md overflow-hidden ${
                    i === activePhotoIndex
                      ? "ring-2 ring-emerald-500"
                      : "ring-1 ring-white/30"
                  }`}
                  style={{ width: 56, height: 56 }}
                  aria-label={`Edit photo ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[10px] font-semibold px-1 rounded">
                    {i + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 relative overflow-hidden">
          <MarkupCanvas
            ref={markupRef}
            imageDataUrl={capturedImages[activePhotoIndex]}
            tool={markupTool}
            undoToken={undoToken}
            strokeWidth={strokeWidth}
            imageSwapToken={imageSwapToken}
            initialHistory={photoHistoriesRef.current[activePhotoIndex] ?? []}
          />
        </div>
        <div className="bg-black px-4 pt-3 pb-2 flex gap-2 justify-center border-t border-white/10">
          {(["draw", "erase", "text"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMarkupTool(t)}
              className={`flex-1 max-w-[90px] py-2.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                markupTool === t
                  ? "bg-white text-black"
                  : "bg-white/10 text-white active:bg-white/20"
              }`}
            >
              {t}
            </button>
          ))}
          <button
            onClick={() => setUndoToken((n) => n + 1)}
            className="flex-1 max-w-[90px] py-2.5 rounded-lg text-sm font-medium bg-white/10 text-white active:bg-white/20"
          >
            Undo
          </button>
        </div>
        {(markupTool === "draw" || markupTool === "erase") && (
          <div className="bg-black px-4 pb-3 flex gap-2 justify-center">
            {[8, 12, 20, 28].map((w) => (
              <button
                key={w}
                onClick={() => setStrokeWidth(w)}
                className={`flex items-center justify-center rounded-full transition-colors ${
                  strokeWidth === w ? "bg-white" : "bg-white/10 active:bg-white/20"
                }`}
                style={{ width: 40, height: 40 }}
                aria-label={`Stroke ${w}px`}
              >
                <span
                  className={strokeWidth === w ? "bg-black" : "bg-white"}
                  style={{
                    display: "block",
                    width: w,
                    height: w,
                    borderRadius: "50%",
                  }}
                />
              </button>
            ))}
          </div>
        )}
        <div className="px-4 py-4 bg-black flex gap-3 border-t border-white/10">
          <button
            onClick={() => setMode("preview")}
            className="flex-1 rounded-xl bg-gray-700 py-4 text-white font-semibold active:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyMarkup}
            className="flex-1 rounded-xl bg-emerald-600 py-4 text-white font-semibold active:bg-emerald-700"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // --- Details mode (scope + save) ---
  if (mode === "details" && capturedImages.length > 0) {
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="px-4 pt-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {capturedImages.map((src, i) => (
              <div
                key={i}
                className="relative flex-shrink-0 w-28 h-28 rounded-lg overflow-hidden bg-gray-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Capture ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                {i === 0 && (
                  <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                    Primary
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {capturedImages.length} photo{capturedImages.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="px-4 py-4 flex-1 overflow-y-auto">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Scope of Work
          </h2>
          <ScopeSelector selected={scopeItems} onChange={setScopeItems} />
        </div>

        <div className="px-4 py-4 bg-white border-t border-gray-200 flex gap-3">
          <button
            onClick={handleStartOver}
            disabled={isWorking}
            className="flex-1 rounded-xl bg-gray-200 py-4 text-gray-800 font-semibold active:bg-gray-300 disabled:opacity-50"
          >
            Start Over
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

  // --- Live + preview modes ---
  const previewImage = capturedImages[capturedImages.length - 1];
  const photoCount = capturedImages.length;

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
        {mode === "preview" && previewImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewImage}
            alt="Captured"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}
        {mode === "live" && zoomCapability && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-1.5 py-1.5 z-10">
            <button
              onClick={() => {
                const next = Math.max(
                  zoomCapability.min,
                  activeZoom - Math.max(zoomCapability.step, 0.5)
                );
                applyZoom(next);
              }}
              disabled={activeZoom <= zoomCapability.min + 0.001}
              className="w-10 h-10 rounded-full bg-white/10 text-white text-xl font-light active:bg-white/20 disabled:opacity-30 flex items-center justify-center"
              aria-label="Zoom out"
            >
              −
            </button>
            <div className="px-3 min-w-[56px] text-center text-white text-sm font-semibold tabular-nums">
              {activeZoom.toFixed(1)}×
            </div>
            <button
              onClick={() => {
                const next = Math.min(
                  zoomCapability.max,
                  activeZoom + Math.max(zoomCapability.step, 0.5)
                );
                applyZoom(next);
              }}
              disabled={activeZoom >= zoomCapability.max - 0.001}
              className="w-10 h-10 rounded-full bg-white/10 text-white text-xl font-light active:bg-white/20 disabled:opacity-30 flex items-center justify-center"
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
        )}
        {/* Photo counter — visible during live mode if photos already taken */}
        {mode === "live" && photoCount > 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1 z-10">
            <p className="text-white text-xs font-medium">
              {photoCount} photo{photoCount === 1 ? "" : "s"} captured
            </p>
          </div>
        )}
      </div>

      <div className="bg-black px-4 py-5 space-y-3">
        {activeEstimateId && (
          <p className="text-center text-xs text-gray-400">
            Active estimate: {activeEstimateId.slice(0, 8)}
          </p>
        )}

        {mode === "live" && (
          <div className="flex gap-2">
            <button
              onClick={handleGalleryClick}
              className="rounded-xl bg-white/10 px-4 py-4 text-white text-sm font-medium active:bg-white/20"
              aria-label="Pick from gallery"
            >
              Gallery
            </button>
            <button
              onClick={handleCapture}
              className="flex-1 rounded-xl bg-white py-4 text-black font-semibold active:bg-gray-200"
            >
              {photoCount === 0 ? "Capture" : "Add Photo"}
            </button>
            {photoCount > 0 && (
              <button
                onClick={() => setMode("preview")}
                className="rounded-xl bg-emerald-600 px-4 py-4 text-white text-sm font-medium active:bg-emerald-700"
              >
                Done
              </button>
            )}
          </div>
        )}

        {mode === "preview" && (
          <div className="flex gap-2">
            <button
              onClick={handleRetake}
              className="rounded-xl bg-gray-700 px-4 py-4 text-white text-sm font-medium active:bg-gray-600"
            >
              Retake
            </button>
            <button
              onClick={handleAddAnother}
              className="flex-1 rounded-xl bg-white/10 py-4 text-white font-semibold active:bg-white/20"
            >
              + Add Photo ({photoCount})
            </button>
            <button
              onClick={handleProceedToMarkup}
              className="rounded-xl bg-emerald-600 px-4 py-4 text-white text-sm font-medium active:bg-emerald-700"
            >
              Next
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFilePicked}
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
}