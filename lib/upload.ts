import { upload } from "@vercel/blob/client";
import { Tree } from "@/types";
import { db } from "./db";

function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(",");
  const meta = dataUrl.slice(0, commaIdx);
  const base64 = dataUrl.slice(commaIdx + 1);
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Upload the primary photo (images[0]) to Vercel Blob if not yet uploaded.
 * Caches the URL on the tree to skip re-upload next time.
 */
export async function ensureTreeImageUploaded(tree: Tree): Promise<string> {
  if (tree.imageUrl) return tree.imageUrl;
  const primary = tree.images?.[0] ?? tree.image;
  if (!primary || !primary.startsWith("data:")) {
    throw new Error("Tree has no image to upload");
  }

  const blob = dataUrlToBlob(primary);
  const filename = `tree-${tree.id}.jpg`;
  const result = await upload(filename, blob, {
    access: "public",
    handleUploadUrl: "/api/upload",
  });

  await db.trees.update(tree.id, { imageUrl: result.url });
  return result.url;
}

export async function ensureAllTreeImagesUploaded(
  trees: Tree[],
  onProgress?: (done: number, total: number) => void
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  let done = 0;
  for (const tree of trees) {
    if (tree.imageUrl) {
      result[tree.id] = tree.imageUrl;
    } else {
      result[tree.id] = await ensureTreeImageUploaded(tree);
    }
    done++;
    onProgress?.(done, trees.length);
  }
  return result;
}