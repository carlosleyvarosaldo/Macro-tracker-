import { Tree } from "@/types";
import { getScopeLabel } from "./scope";

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildDescriptionHtml(tree: Tree, imageUrl: string | null): string {
  const scopeLabels = (tree.scopeItems ?? [])
    .map((id) => escapeXml(getScopeLabel(id)))
    .map((label) => `<li>${label}</li>`)
    .join("");

  const scopeBlock = scopeLabels
    ? `<p><b>Scope of Work:</b></p><ul>${scopeLabels}</ul>`
    : `<p><b>Scope of Work:</b> <i>None selected</i></p>`;

  const notesBlock = tree.notes?.trim()
    ? `<p><b>Notes:</b><br/>${escapeXml(tree.notes)}</p>`
    : "";

  const measurementParts: string[] = [];
  if (tree.dbh != null) measurementParts.push(`DBH: ${tree.dbh}"`);
  if (tree.height != null) measurementParts.push(`Height: ${tree.height}'`);
  const measurementBlock =
    measurementParts.length > 0
      ? `<p><b>Measurements:</b> ${escapeXml(measurementParts.join("    "))}</p>`
      : "";

  const imageBlock = imageUrl
    ? `<p><img src="${escapeXml(imageUrl)}" style="max-width:600px;width:100%;" /></p>`
    : "";

  return [imageBlock, measurementBlock, scopeBlock, notesBlock]
    .filter(Boolean)
    .join("");
}

function buildPlacemark(
  tree: Tree,
  index: number,
  imageUrl: string | null
): string {
  const name = escapeXml(tree.label?.trim() || `Tree ${index + 1}`);
  const description = buildDescriptionHtml(tree, imageUrl);
  const coords = `${tree.lng},${tree.lat},0`;

  return `    <Placemark>
      <name>${name}</name>
      <description><![CDATA[${description}]]></description>
      <Point>
        <coordinates>${coords}</coordinates>
      </Point>
    </Placemark>`;
}

export function buildKml(
  trees: Tree[],
  imageUrls: Record<string, string>,
  documentName = "Arborist Estimate"
): string {
  const placemarks = trees
    .map((tree, i) => buildPlacemark(tree, i, imageUrls[tree.id] ?? null))
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(documentName)}</name>
${placemarks}
  </Document>
</kml>`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadKml(kml: string, filename: string): void {
  const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
  downloadBlob(blob, filename);
}

export function hasValidLocation(tree: Tree): boolean {
  return !(tree.lat === 0 && tree.lng === 0);
}