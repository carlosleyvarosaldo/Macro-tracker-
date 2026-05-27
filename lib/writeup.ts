import { Tree, Estimate } from "@/types";

const SCOPE_VERB_PHRASES: Record<number, string> = {
  1: "remove deadwood",
  2: "remove ball moss and mistletoe",
  3: "remove lower sprouts",
  4: "remove broken branches",
  5: "cut and remove vines",
  6: "take weight off extended limbs",
  7: "thin out canopy",
  8: "raise canopy all around",
  9: "clear from roof and lines",
  10: "shape shrubs",
  11: "remove tree to ground level",
  12: "remove shrubs to ground level",
  13: "leave firewood stacked",
  15: "leave wood at curbside",
  16: "cut and drop wood on site",
  19: "install support cable",
  20: "top tree",
};

const JOB_WIDE_PHRASES: Record<number, string> = {
  14: "haul away debris",
  17: "apply foam treatment",
  18: "use additional trailers for debris removal",
};

const REMOVAL_IDS = new Set([11, 12]);
const TRAILING_IDS = new Set([13, 15, 16]);

function joinPhrases(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isInlineNote(note: string): boolean {
  const trimmed = note.trim();
  if (!trimmed) return false;
  if (trimmed.length > 60) return false;
  if (/[.!?]$/.test(trimmed)) return false;
  if (/[.!?]\s/.test(trimmed)) return false;
  return true;
}

function treeNoun(tree: Tree, fallbackIndex: number): string {
  const label = tree.label?.trim();
  if (label) return label;
  return `Tree ${fallbackIndex + 1}`;
}

function buildScopeSentence(tree: Tree, fallbackIndex: number): string {
  const scope = tree.scopeItems ?? [];
  const note = tree.notes?.trim() ?? "";
  const inlineNote = isInlineNote(note) ? note : "";
  const trailingNote = note && !inlineNote ? note : "";

  const noun = treeNoun(tree, fallbackIndex);

  const removalIds = scope.filter((id) => REMOVAL_IDS.has(id));
  if (removalIds.length > 0) {
    let sentence = `Remove ${noun}`;
    if (inlineNote) sentence += ` ${inlineNote}`;
    sentence += ` to ground level.`;
    if (trailingNote) sentence += `\nNotes: ${trailingNote}`;
    return sentence;
  }

  const treeIds = scope.filter(
    (id) => SCOPE_VERB_PHRASES[id] && !TRAILING_IDS.has(id)
  );
  const trailingIds = scope.filter((id) => TRAILING_IDS.has(id));

  const phrases = treeIds.map((id) => SCOPE_VERB_PHRASES[id]);
  const trailingPhrases = trailingIds.map((id) => SCOPE_VERB_PHRASES[id]);

  if (phrases.length === 0 && trailingPhrases.length === 0) {
    return `${capitalizeFirst(noun)}: scope to be determined.`;
  }

  let sentence = `Trim ${noun}`;
  if (inlineNote) sentence += ` ${inlineNote}`;

  if (phrases.length > 0) {
    sentence += ` to ${joinPhrases(phrases)}`;
    if (trailingPhrases.length > 0) {
      sentence += `; ${joinPhrases(trailingPhrases)}`;
    }
  } else if (trailingPhrases.length > 0) {
    sentence += `; ${joinPhrases(trailingPhrases)}`;
  }
  sentence += ".";

  if (trailingNote) {
    sentence += `\nNotes: ${trailingNote}`;
  }
  return capitalizeFirst(sentence);
}

function buildJobWideLine(trees: Tree[]): string {
  const ids = new Set<number>();
  for (const tree of trees) {
    for (const id of tree.scopeItems ?? []) {
      if (JOB_WIDE_PHRASES[id]) ids.add(id);
    }
  }
  if (ids.size === 0) return "";
  const phrases = Array.from(ids).map((id) => JOB_WIDE_PHRASES[id]);
  return capitalizeFirst(joinPhrases(phrases)) + ".";
}

/** Structured per-tree block — used for rich rendering AND for plain text. */
export type WriteUpTreeBlock = {
  name: string;
  priceLine: string; // e.g. "Q: 300"
  scope: string;
};

export type WriteUpStructured = {
  trees: WriteUpTreeBlock[];
  /** Job-wide trailing line, e.g. "Haul away debris." */
  closing: string;
};

function formatPriceLine(tree: Tree): string {
  const price = tree.price ?? 0;
  if (price <= 0) return "";
  return `Q: ${price % 1 === 0 ? price.toString() : price.toFixed(2)}`;
}

/** Build the structured write-up — preferred for rich rendering. */
export function generateStructuredWriteUp(trees: Tree[]): WriteUpStructured {
  return {
    trees: trees.map((tree, i) => ({
      name: treeNoun(tree, i),
      priceLine: formatPriceLine(tree),
      scope: buildScopeSentence(tree, i),
    })),
    closing: buildJobWideLine(trees),
  };
}

/** Flat plain-text version — used for the textarea + plain copy fallback. */
export function generateFullEstimateWriteUp(trees: Tree[]): string {
  if (trees.length === 0) return "";
  const structured = generateStructuredWriteUp(trees);
  const blocks: string[] = [];
  for (const t of structured.trees) {
    const lines: string[] = [];
    lines.push(t.name);
    if (t.priceLine) lines.push(t.priceLine);
    lines.push(t.scope);
    blocks.push(lines.join("\n"));
  }
  if (structured.closing) {
    blocks.push(structured.closing);
  }
  // Double-spacing between trees
  return blocks.join("\n\n");
}

/** HTML version with bold formatting — for rich clipboard. */
export function generateHtmlWriteUp(trees: Tree[]): string {
  if (trees.length === 0) return "";
  const structured = generateStructuredWriteUp(trees);

  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const blocks: string[] = [];
  for (const t of structured.trees) {
    const parts: string[] = [];
    parts.push(`<p><strong>${escape(t.name)}</strong></p>`);
    if (t.priceLine) {
      parts.push(`<p><strong>${escape(t.priceLine)}</strong></p>`);
    }
    // Scope might include a `Notes:` line — convert \n to <br>
    const scopeHtml = escape(t.scope).replace(/\n/g, "<br>");
    parts.push(`<p>${scopeHtml}</p>`);
    blocks.push(parts.join(""));
  }
  if (structured.closing) {
    blocks.push(`<p>${escape(structured.closing)}</p>`);
  }
  // Visual separation between trees
  return blocks.join('<p>&nbsp;</p>');
}

/** Per-tree write-up for the single-tree case. */
export function generateTreeWriteUp(tree: Tree): string {
  return buildScopeSentence(tree, 0);
}

export function resolveEstimateWriteUp(
  estimate: Estimate | undefined,
  trees: Tree[]
): string {
  const override = estimate?.writeUp?.trim();
  if (override) return override;
  return generateFullEstimateWriteUp(trees);
}