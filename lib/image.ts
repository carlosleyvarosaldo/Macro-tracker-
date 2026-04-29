/**
 * Draws a video frame to a canvas, scales it to maxWidth (preserving aspect),
 * and returns a compressed JPEG as a base64 data URL.
 */
export function captureFrameAsJpeg(
  video: HTMLVideoElement,
  maxWidth = 1200,
  quality = 0.7
): string {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;

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

  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL("image/jpeg", quality);
}
