import { upload } from "@vercel/blob/client";
import { Tree } from "@/types";
import { db } from "./db";

/** Convert a `data:image/jpeg;base64,...` string into a Blob. */
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
 * Upload a tree's image to Vercel Blob if it hasn't been uploaded yet.
 * Caches the resulting URL on the tree record so we never re-upload.
 * Returns the public URL.
 */
export async function ensureTreeImageUploaded(tree: Tree): Promise<string> {
  if (tree.imageUrl) return tree.imageUrl;
  if (!tree.image || !tree.image.startsWith("data:")) {
    throw new Error("Tree has no image to upload");
  }

  const blob = dataUrlToBlob(tree.image);
  const filename = `tree-${tree.id}.jpg`;

  const result = await upload(filename, blob, {
    access: "public",
    handleUploadUrl: "/api/upload",
  });

  // Persist the URL on the tree so future exports skip re-upload
  await db.trees.update(tree.id, { imageUrl: result.url });

  return result.url;
}

/**
 * Upload all trees that don't yet have a hosted URL.
 * Returns map of treeId -> url for the full set.
 */
export async function ensureAllTreeImagesUploaded(
  trees: Tree[],
  onProgress?: (done: number, total: number) => void
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  let done = 0;

  // Sequential to avoid hitting rate limits and to give clean progress
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