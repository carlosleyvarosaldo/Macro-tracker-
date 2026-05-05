import { jsPDF } from "jspdf";
import { Tree } from "@/types";
import { getScopeLabel } from "./scope";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const IMAGE_MAX_HEIGHT = 260;
const THUMB_SIZE = 80;

function loadImageDimensions(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = dataUrl;
  });
}

function totalPrice(trees: Tree[]): number {
  return trees.reduce((sum, t) => sum + (t.price ?? 0), 0);
}

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function ensureSpace(doc: jsPDF, cursorY: number, needed: number): number {
  if (cursorY + needed > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return cursorY;
}

function drawHeader(doc: jsPDF, total: number): number {
  let y = MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Tree Estimate", MARGIN, y);
  y += 28;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Total: ${formatMoney(total)}`, MARGIN, y);
  y += 8;
  doc.setDrawColor(180);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 20;
  return y;
}

async function drawTree(
  doc: jsPDF,
  tree: Tree,
  index: number,
  startY: number
): Promise<number> {
  let y = startY;
  const images = tree.images?.length ? tree.images : tree.image ? [tree.image] : [];
  const primary = images[0];
  const additional = images.slice(1);

  // Compute primary image dimensions
  let imgWidth = 0;
  let imgHeight = 0;
  if (primary && primary.startsWith("data:")) {
    try {
      const { w, h } = await loadImageDimensions(primary);
      const scale = Math.min(CONTENT_WIDTH / w, IMAGE_MAX_HEIGHT / h);
      imgWidth = w * scale;
      imgHeight = h * scale;
    } catch {
      imgWidth = 0;
      imgHeight = 0;
    }
  }

  const scopeCount = (tree.scopeItems ?? []).length;
  const noteLines = tree.notes?.trim()
    ? doc.splitTextToSize(tree.notes, CONTENT_WIDTH).length
    : 0;
  const additionalRows = Math.ceil(additional.length / 6);
  const estimatedHeight =
    20 +
    (imgHeight ? imgHeight + 12 : 0) +
    (additional.length > 0 ? additionalRows * (THUMB_SIZE + 8) : 0) +
    18 +
    (scopeCount > 0 ? 18 + scopeCount * 14 : 18) +
    (noteLines > 0 ? 18 + noteLines * 14 : 0) +
    20;

  y = ensureSpace(doc, y, estimatedHeight);

  const treeLabel = tree.label?.trim() || `Tree ${index + 1}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(treeLabel, MARGIN, y);
  y += 18;

  if (imgWidth > 0 && imgHeight > 0 && primary) {
    try {
      doc.addImage(primary, "JPEG", MARGIN, y, imgWidth, imgHeight);
      y += imgHeight + 12;
    } catch {
      // skip
    }
  }

  // Additional thumbnails — laid out in a row, wrap if needed
  if (additional.length > 0) {
    let xCursor = MARGIN;
    for (const thumb of additional) {
      if (xCursor + THUMB_SIZE > PAGE_WIDTH - MARGIN) {
        xCursor = MARGIN;
        y += THUMB_SIZE + 6;
        y = ensureSpace(doc, y, THUMB_SIZE + 12);
      }
      try {
        doc.addImage(thumb, "JPEG", xCursor, y, THUMB_SIZE, THUMB_SIZE);
      } catch {
        // skip silently
      }
      xCursor += THUMB_SIZE + 6;
    }
    y += THUMB_SIZE + 12;
  }

doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Price: ", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatMoney(tree.price ?? 0), MARGIN + 38, y);
  y += 18;

  // Measurements (DBH / Height) — only if at least one is set
  if (tree.dbh != null || tree.height != null) {
    const parts: string[] = [];
    if (tree.dbh != null) parts.push(`DBH: ${tree.dbh}"`);
    if (tree.height != null) parts.push(`Height: ${tree.height}'`);
    doc.setFont("helvetica", "normal");
    doc.text(parts.join("    "), MARGIN, y);
    y += 16;
  }
  doc.setFont("helvetica", "bold");
  doc.text("Scope of Work:", MARGIN, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  if (scopeCount === 0) {
    doc.setTextColor(120);
    doc.text("None selected", MARGIN + 12, y);
    doc.setTextColor(0);
    y += 14;
  } else {
    for (const id of tree.scopeItems) {
      doc.text(`• ${getScopeLabel(id)}`, MARGIN + 12, y);
      y += 14;
    }
  }
  y += 4;

  if (tree.notes?.trim()) {
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", MARGIN, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(tree.notes, CONTENT_WIDTH);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 14;
  }

  y += 12;
  doc.setDrawColor(220);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 16;
  return y;
}

function drawWriteUpSection(doc: jsPDF, writeUp: string): void {
  if (!writeUp.trim()) return;
  doc.addPage();
  let y = MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Scope Write-Up", MARGIN, y);
  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(writeUp, CONTENT_WIDTH);
  for (const line of lines) {
    y = ensureSpace(doc, y, 16);
    doc.text(line, MARGIN, y);
    y += 16;
  }
}

export async function buildEstimatePdf(
  trees: Tree[],
  writeUp = ""
): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = drawHeader(doc, totalPrice(trees));
  for (let i = 0; i < trees.length; i++) {
    y = await drawTree(doc, trees[i], i, y);
  }
  drawWriteUpSection(doc, writeUp);
  return doc.output("blob");
}