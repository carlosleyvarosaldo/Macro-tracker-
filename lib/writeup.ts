import { Tree, Estimate } from "@/types";

export const WRITEUP_MAP: Record<number, string> = {
  1: "Prune deadwood throughout the tree.",
  2: "Remove ball moss and mistletoe.",
  3: "Remove basal and epicormic sprouts.",
  4: "Remove broken and damaged limbs.",
  5: "Cut and remove all vines from the tree.",
  6: "Reduce weight on extended limbs.",
  7: "Thin canopy to improve airflow and light penetration.",
  8: "Raise canopy to improve clearance.",
  9: "Clear roof and structure lines.",
  10: "Shape shrubs for uniform appearance.",
  11: "Remove tree to ground level.",
  12: "Remove shrubs to ground level.",
  13: "Cut and stack firewood on site.",
  14: "Haul away all debris from property.",
  15: "Leave wood neatly at curbside.",
  16: "Cut and drop wood on site.",
  17: "Apply foam treatment as needed.",
  18: "Use additional trailers for debris removal.",
  19: "Install support cable as specified.",
};

/** Build a per-tree write-up: scope sentences as one paragraph, optional notes after. */
export function generateTreeWriteUp(tree: Tree): string {
  const sentences = (tree.scopeItems ?? [])
    .map((id) => WRITEUP_MAP[id])
    .filter((s): s is string => Boolean(s));

  const scopeParagraph = sentences.length > 0 ? sentences.join(" ") : "";
  const trimmedNotes = tree.notes?.trim();

  const parts: string[] = [];
  if (scopeParagraph) parts.push(scopeParagraph);
  if (trimmedNotes) parts.push(`Notes: ${trimmedNotes}`);

  return parts.join("\n\n");
}

/** Combine all tree write-ups into a single estimate document. */
export function generateFullEstimateWriteUp(trees: Tree[]): string {
  if (trees.length === 0) return "";

  const blocks = trees.map((tree, i) => {
    const heading = tree.label?.trim() || `Tree ${i + 1}`;
    const body = generateTreeWriteUp(tree);
    return body ? `${heading}\n${body}` : `${heading}\n(No scope or notes specified.)`;
  });

  return blocks.join("\n\n");
}

/**
 * Resolve which write-up to use for an estimate:
 * - if the user has manually saved an override, use that
 * - otherwise generate fresh from the trees
 */
export function resolveEstimateWriteUp(
  estimate: Estimate | undefined,
  trees: Tree[]
): string {
  const override = estimate?.writeUp?.trim();
  if (override) return override;
  return generateFullEstimateWriteUp(trees);
}