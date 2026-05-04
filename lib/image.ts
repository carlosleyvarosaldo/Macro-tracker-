/**
 * Draws a video frame to a canvas, scales it to maxWidth (preserving aspect),
 * and returns a compressed JPEG as a base64 data URL.
 */
export function captureFrameAsJpeg(
  video: HTMLVideoElement,
  maxWidth = 1200,
  quality = 0.7
): string {
  // Some browsers report videoWidth=0 right after stream attachment.
  // Fall back to MediaStream track settings if so.
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