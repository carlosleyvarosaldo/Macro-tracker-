import { jsPDF } from "jspdf";
import { Tree } from "@/types";
import { getScopeLabel } from "./scope";

// A4 page in points
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

// Colors
const COLOR_GREEN = "#10b981";
const COLOR_GREEN_PALE = "#ecfdf5";
const COLOR_TEXT = "#111827";
const COLOR_MUTED = "#6b7280";
const COLOR_LIGHT_BORDER = "#e5e7eb";

type EstimateMeta = {
  estimateName?: string;
  address?: string;
  createdAt?: number;
};

function loadImageDimensions(
  dataUrl: string
): Promise<{ w: number; h: number }> {
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

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function ensureSpace(doc: jsPDF, cursorY: number, needed: number): number {
  if (cursorY + needed > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return cursorY;
}

function setFillFromHex(doc: jsPDF, hex: string): void {
  // jsPDF accepts hex string directly when passed without alpha
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  doc.setFillColor(r, g, b);
}

function setStrokeFromHex(doc: jsPDF, hex: string): void {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  doc.setDrawColor(r, g, b);
}

function setTextFromHex(doc: jsPDF, hex: string): void {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  doc.setTextColor(r, g, b);
}

function drawHeader(doc: jsPDF, meta: EstimateMeta, total: number): number {
  let y = MARGIN;

  // Title
  setTextFromHex(doc, COLOR_TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(meta.estimateName?.trim() || "Tree Estimate", MARGIN, y + 6);
  y += 24;

  // Subtitle line: address (if any) + date
  setTextFromHex(doc, COLOR_MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const subtitleParts: string[] = [];
  if (meta.address?.trim()) subtitleParts.push(meta.address.trim());
  if (meta.createdAt) subtitleParts.push(formatDate(meta.createdAt));
  if (subtitleParts.length > 0) {
    doc.text(subtitleParts.join(" · "), MARGIN, y);
    y += 14;
  }

  // Total chip on the right of header
  const totalLabel = `Total: ${formatMoney(total)}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setTextFromHex(doc, COLOR_TEXT);
  const totalWidth = doc.getTextWidth(totalLabel);
  const chipPadX = 12;
  const chipPadY = 6;
  const chipX = PAGE_WIDTH - MARGIN - totalWidth - chipPadX * 2;
  const chipY = MARGIN - 4;
  setFillFromHex(doc, COLOR_GREEN_PALE);
  setStrokeFromHex(doc, COLOR_GREEN);
  doc.roundedRect(
    chipX,
    chipY,
    totalWidth + chipPadX * 2,
    18 + chipPadY,
    6,
    6,
    "FD"
  );
  setTextFromHex(doc, COLOR_GREEN);
  doc.text(totalLabel, chipX + chipPadX, chipY + 16);

  y += 10;
  return y;
}

function drawWriteUpBox(doc: jsPDF, writeUp: string, startY: number): number {
  let y = startY;
  if (!writeUp.trim()) return y;

  // Section header
  setTextFromHex(doc, COLOR_TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Write-up", MARGIN, y);
  y += 10;

  // Compute height needed
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const padX = 14;
  const padY = 14;
  const innerWidth = CONTENT_WIDTH - padX * 2;
  const lines = doc.splitTextToSize(writeUp, innerWidth);
  const lineHeight = 14;
  const boxHeight = padY * 2 + lines.length * lineHeight;

  // Box background + border
  setFillFromHex(doc, "#ffffff");
  setStrokeFromHex(doc, COLOR_LIGHT_BORDER);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, boxHeight, 8, 8, "FD");

  // Text inside
  setTextFromHex(doc, COLOR_TEXT);
  let textY = y + padY + 10; // baseline-ish offset
  for (const line of lines) {
    doc.text(line, MARGIN + padX, textY);
    textY += lineHeight;
  }

  y += boxHeight + 18;
  return y;
}

function drawLineItemTable(
  doc: jsPDF,
  trees: Tree[],
  startY: number
): number {
  let y = startY;

  // Section header
  setTextFromHex(doc, COLOR_TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Line items", MARGIN, y);
  y += 10;

  // Table column widths (sum should equal CONTENT_WIDTH)
  const cols = {
    location: 110,
    scope: 150,
    notes: 110,
    options: 80,
    cost: CONTENT_WIDTH - 110 - 150 - 110 - 80,
  };

  const headerHeight = 22;
  const rowMinHeight = 22;
  const cellPadX = 6;
  const cellPadY = 5;

  // --- Header row ---
  setFillFromHex(doc, "#f9fafb");
  setStrokeFromHex(doc, COLOR_LIGHT_BORDER);
  doc.rect(MARGIN, y, CONTENT_WIDTH, headerHeight, "FD");
  setTextFromHex(doc, COLOR_TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);

  let xCursor = MARGIN;
  const columns: Array<{ key: keyof typeof cols; label: string; align?: "right" }> = [
    { key: "location", label: "Tree / location" },
    { key: "scope", label: "Scope of work" },
    { key: "notes", label: "Notes" },
    { key: "options", label: "Options" },
    { key: "cost", label: "Cost", align: "right" },
  ];
  for (const col of columns) {
    const w = cols[col.key];
    if (col.align === "right") {
      doc.text(col.label, xCursor + w - cellPadX, y + 14, { align: "right" });
    } else {
      doc.text(col.label, xCursor + cellPadX, y + 14);
    }
    xCursor += w;
  }

  y += headerHeight;

  // --- Data rows ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  trees.forEach((tree, i) => {
    const locationText = (tree.label?.trim() || `Tree ${i + 1}`).slice(0, 80);
    const scopeText =
      (tree.scopeItems ?? [])
        .map((id) => getScopeLabel(id))
        .join(", ") || "—";
    const notesText = tree.notes?.trim() || "—";
    // "Options" — measurement summary or extra context per tree
    const optionsParts: string[] = [];
    if (tree.dbh != null) optionsParts.push(`DBH ${tree.dbh}"`);
    if (tree.height != null) optionsParts.push(`H ${tree.height}'`);
    const optionsText = optionsParts.length > 0 ? optionsParts.join(", ") : "—";
    const costText = formatMoney(tree.price ?? 0);

    // Wrap each cell to its width
    const wrapped = {
      location: doc.splitTextToSize(
        locationText,
        cols.location - cellPadX * 2
      ),
      scope: doc.splitTextToSize(scopeText, cols.scope - cellPadX * 2),
      notes: doc.splitTextToSize(notesText, cols.notes - cellPadX * 2),
      options: doc.splitTextToSize(optionsText, cols.options - cellPadX * 2),
      cost: doc.splitTextToSize(costText, cols.cost - cellPadX * 2),
    };

    const maxLines = Math.max(
      wrapped.location.length,
      wrapped.scope.length,
      wrapped.notes.length,
      wrapped.options.length,
      wrapped.cost.length
    );
    const lineHeight = 11;
    const rowHeight = Math.max(rowMinHeight, maxLines * lineHeight + cellPadY * 2);

    // Page break check
    if (y + rowHeight > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
      // Redraw mini header so the table is readable on subsequent pages
      setFillFromHex(doc, "#f9fafb");
      setStrokeFromHex(doc, COLOR_LIGHT_BORDER);
      doc.rect(MARGIN, y, CONTENT_WIDTH, headerHeight, "FD");
      setTextFromHex(doc, COLOR_TEXT);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      let hx = MARGIN;
      for (const col of columns) {
        const w = cols[col.key];
        if (col.align === "right") {
          doc.text(col.label, hx + w - cellPadX, y + 14, { align: "right" });
        } else {
          doc.text(col.label, hx + cellPadX, y + 14);
        }
        hx += w;
      }
      y += headerHeight;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
    }

    // Alternating row background (cream-ish like the template)
    if (i % 2 === 0) {
      setFillFromHex(doc, "#fefce8");
      setStrokeFromHex(doc, COLOR_LIGHT_BORDER);
      doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, "FD");
    } else {
      setFillFromHex(doc, "#ffffff");
      setStrokeFromHex(doc, COLOR_LIGHT_BORDER);
      doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, "FD");
    }

    // Cell text
    setTextFromHex(doc, COLOR_TEXT);
    let cx = MARGIN;
    const drawCell = (
      key: keyof typeof cols,
      lines: string[],
      align?: "right"
    ) => {
      const w = cols[key];
      const baseX = align === "right" ? cx + w - cellPadX : cx + cellPadX;
      let textY = y + cellPadY + 9;
      for (const line of lines) {
        if (align === "right") {
          doc.text(line, baseX, textY, { align: "right" });
        } else {
          doc.text(line, baseX, textY);
        }
        textY += lineHeight;
      }
      cx += w;
    };
    drawCell("location", wrapped.location);
    drawCell("scope", wrapped.scope);
    drawCell("notes", wrapped.notes);
    drawCell("options", wrapped.options);
    drawCell("cost", wrapped.cost, "right");

    y += rowHeight;
  });

  // --- Subtotal row ---
  if (y + rowMinHeight > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    y = MARGIN;
  }
  setFillFromHex(doc, "#ffffff");
  setStrokeFromHex(doc, COLOR_LIGHT_BORDER);
  doc.rect(MARGIN, y, CONTENT_WIDTH, rowMinHeight, "FD");
  setTextFromHex(doc, COLOR_TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const subTotalLabel = "Sub total";
  const subTotalValue = formatMoney(totalPrice(trees));
  // Position label in the "options" column area, value in cost column
  const optionsX = MARGIN + cols.location + cols.scope + cols.notes;
  doc.text(subTotalLabel, optionsX + cols.options - cellPadX, y + 14, {
    align: "right",
  });
  doc.text(subTotalValue, MARGIN + CONTENT_WIDTH - cellPadX, y + 14, {
    align: "right",
  });
  y += rowMinHeight + 18;

  return y;
}

async function drawTreeDetail(
  doc: jsPDF,
  tree: Tree,
  index: number,
  startY: number
): Promise<number> {
  let y = startY;

  // Estimate detail card height
  const photoBoxSize = 110;
  const cardPad = 14;
  const labelHeight = 12;
  const lineHeight = 13;

  const fields = [
    { label: "Tree name:", value: tree.label?.trim() || `Tree ${index + 1}` },
    {
      label: "Tree location:",
      value:
        tree.lat || tree.lng
          ? `${tree.lat.toFixed(5)}, ${tree.lng.toFixed(5)}`
          : "—",
    },
    {
      label: "Scope of work:",
      value:
        (tree.scopeItems ?? [])
          .map((id) => getScopeLabel(id))
          .join(", ") || "—",
    },
    { label: "Notes:", value: tree.notes?.trim() || "—" },
  ];

  // Pre-wrap text fields to compute card height
  const textColX = MARGIN + photoBoxSize + cardPad * 2;
  const textWidth = PAGE_WIDTH - MARGIN - textColX - cardPad;
  const wrappedFields = fields.map((f) => ({
    label: f.label,
    lines: doc.splitTextToSize(f.value, textWidth),
  }));
  const textBlockHeight = wrappedFields.reduce(
    (h, f) => h + labelHeight + f.lines.length * lineHeight + 6,
    0
  );
  const cardHeight = Math.max(photoBoxSize + cardPad * 2, textBlockHeight + cardPad * 2);

  // Page break
  y = ensureSpace(doc, y, cardHeight + 16);

  // Card background
  setFillFromHex(doc, "#ffffff");
  setStrokeFromHex(doc, COLOR_LIGHT_BORDER);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, cardHeight, 10, 10, "FD");

  // Photo
  const primary = tree.images?.[0] ?? tree.image;
  const photoX = MARGIN + cardPad;
  const photoY = y + cardPad;
  setFillFromHex(doc, "#f3f4f6");
  doc.roundedRect(photoX, photoY, photoBoxSize, photoBoxSize, 6, 6, "F");
  if (primary && primary.startsWith("data:")) {
    try {
      const { w, h } = await loadImageDimensions(primary);
      const scale = Math.min(photoBoxSize / w, photoBoxSize / h);
      const drawW = w * scale;
      const drawH = h * scale;
      doc.addImage(
        primary,
        "JPEG",
        photoX + (photoBoxSize - drawW) / 2,
        photoY + (photoBoxSize - drawH) / 2,
        drawW,
        drawH
      );
    } catch {
      // skip
    }
  }

  // Text fields
  let textY = y + cardPad + 8;
  for (const f of wrappedFields) {
    setTextFromHex(doc, COLOR_MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(f.label, textColX, textY);
    textY += labelHeight;
    setTextFromHex(doc, COLOR_TEXT);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const line of f.lines) {
      doc.text(line, textColX, textY);
      textY += lineHeight;
    }
    textY += 4;
  }

  return y + cardHeight + 14;
}

export async function buildEstimatePdf(
  trees: Tree[],
  writeUp = "",
  meta: EstimateMeta = {}
): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const total = totalPrice(trees);

  // Page 1: Header + write-up + line item table
  let y = drawHeader(doc, meta, total);
  y = drawWriteUpBox(doc, writeUp, y);
  if (trees.length > 0) {
    y = drawLineItemTable(doc, trees, y);
  }

  // Per-tree detail cards — start on a new page for clarity
  if (trees.length > 0) {
    doc.addPage();
    let detailY = MARGIN;
    setTextFromHex(doc, COLOR_TEXT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Tree details", MARGIN, detailY + 6);
    detailY += 28;
    for (let i = 0; i < trees.length; i++) {
      detailY = await drawTreeDetail(doc, trees[i], i, detailY);
    }
  }

  return doc.output("blob");
}