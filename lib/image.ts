/**
 * Capture a frame from a live <video> as compressed JPEG (camera capture path).
 */
export function captureFrameAsJpeg(
  video: HTMLVideoElement,
  maxWidth = 1200,
  quality = 0.7
): string {
  let sourceWidth = video.videoWidth;
  let sourceHeight = video.videoHeight;

  if (!sourceWidth || !sourceHeight) {
    const stream = video.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()[0];
    const settings = track?.getSettings();
    sourceWidth = settings?.width ?? 0;
    sourceHeight = settings?.height ?? 0;
  }

  if (!sourceWidth || !sourceHeight) {
    throw new Error("Video stream not ready");
  }

  const scale = Math.min(1, maxWidth / sourceWidth);
  const targetWidth = Math.round(sourceWidth * scale);
  const targetHeight = Math.round(sourceHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  try {
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL("image/jpeg", quality);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    throw new Error(`Frame encode failed: ${msg}`);
  }
}

/**
 * Take a File (gallery upload) and return a downscaled JPEG data URL.
 */
export function processImageFile(
  file: File,
  maxWidth = 1920,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Selected file is not an image"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        reject(new Error("Could not decode file"));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        try {
          const sw = img.naturalWidth;
          const sh = img.naturalHeight;
          if (!sw || !sh) {
            reject(new Error("Image has no dimensions"));
            return;
          }

          const scale = Math.min(1, maxWidth / sw);
          const tw = Math.round(sw * scale);
          const th = Math.round(sh * scale);

          const canvas = document.createElement("canvas");
          canvas.width = tw;
          canvas.height = th;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas 2D context unavailable"));
            return;
          }

          ctx.drawImage(img, 0, 0, tw, th);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (err) {
          reject(
            new Error(
              `Image processing failed: ${
                err instanceof Error ? err.message : "unknown"
              }`
            )
          );
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}