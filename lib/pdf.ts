import { jsPDF } from "jspdf";
import { Tree } from "@/types";
import { getScopeLabel } from "./scope";

const PAGE_WIDTH = 595.28;   // A4 width in pt
const PAGE_HEIGHT = 841.89;  // A4 height in pt
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const IMAGE_MAX_HEIGHT = 260;

/** Load a base64 data URL into an Image to read its natural dimensions. */
function loadImageDimensions(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = dataUrl;
  });
}

/** Sum all tree prices, treating missing values as 0. */
function totalPrice(trees: Tree[]): number {
  return trees.reduce((sum, t) => sum + (t.price ?? 0), 0);
}

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Reserve vertical space; add a new page if it won't fit. */
function ensureSpace(doc: jsPDF, cursorY: number, needed: number): number {
  if (cursorY + needed > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return cursorY;
}

/** Render the header block with title and total. */
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

  // Underline below header
  doc.setDrawColor(180);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 20;

  return y;
}

/** Render a single tree block. Returns the new cursor Y position. */
async function drawTree(
  doc: jsPDF,
  tree: Tree,
  index: number,
  startY: number
): Promise<number> {
  let y = startY;

  // Compute image dimensions ahead of time so we can plan page breaks
  let imgWidth = 0;
  let imgHeight = 0;
  if (tree.image && tree.image.startsWith("data:")) {
    try {
      const { w, h } = await loadImageDimensions(tree.image);
      const scale = Math.min(CONTENT_WIDTH / w, IMAGE_MAX_HEIGHT / h);
      imgWidth = w * scale;
      imgHeight = h * scale;
    } catch {
      imgWidth = 0;
      imgHeight = 0;
    }
  }

  // Estimate total block height: label + image + price + scope + notes + padding
  const scopeCount = (tree.scopeItems ?? []).length;
  const noteLines = tree.notes?.trim()
    ? doc.splitTextToSize(tree.notes, CONTENT_WIDTH).length
    : 0;
  const estimatedHeight =
    20 + // label
    (imgHeight ? imgHeight + 12 : 0) +
    18 + // price
    (scopeCount > 0 ? 18 + scopeCount * 14 : 18) + // scope heading + items, or "none"
    (noteLines > 0 ? 18 + noteLines * 14 : 0) +
    20; // bottom padding

  y = ensureSpace(doc, y, estimatedHeight);

  // Tree label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const treeLabel = tree.label?.trim() || `Tree ${index + 1}`;
  doc.text(treeLabel, MARGIN, y);
  y += 18;

  // Image
  if (imgWidth > 0 && imgHeight > 0) {
    try {
      doc.addImage(tree.image, "JPEG", MARGIN, y, imgWidth, imgHeight);
      y += imgHeight + 12;
    } catch {
      // Skip image silently if jsPDF rejects it
    }
  }

  // Price
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Price: ", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatMoney(tree.price ?? 0), MARGIN + 38, y);
  y += 18;

  // Scope of work
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

  // Notes
  if (tree.notes?.trim()) {
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", MARGIN, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(tree.notes, CONTENT_WIDTH);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 14;
  }

  // Block separator
  y += 12;
  doc.setDrawColor(220);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 16;

  return y;
}

/** Render the trailing additional-notes section. */
function drawWriteUpSection(doc: jsPDF, writeUp: string): void {
  if (!writeUp.trim()) return;

  // Always start on a fresh page so the write-up reads cleanly
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

/** Build a complete PDF document for the given trees. */
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