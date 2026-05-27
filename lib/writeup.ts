import { Tree, Estimate } from "@/types";

/**
 * Verb phrases for each scope item, in the form they take when joined into
 * a sentence like "Trim {label} to ...".
 *
 * Some items are job-wide (haul, foam, extra trailers) — handled separately.
 */
const SCOPE_VERB_PHRASES: Record<number, string> = {
  1: "remove deadwood",
  2: "remove ball moss and mistletoe",
  3: "remove lower sprouts",
  4: "remove broken limbs",
  5: "cut and remove vines",
  6: "reduce weight on extended limbs",
  7: "thin out canopy",
  8: "raise canopy",
  9: "clear roof and structure lines",
  10: "shape shrubs",
  11: "remove tree to ground level",
  12: "remove shrubs to ground level",
  13: "leave firewood stacked",
  15: "leave wood at curbside",
  16: "cut and drop wood on site",
  19: "install support cable",
  20: "top tree",
};

/** Scope items that apply to the whole job, not individual trees. */
const JOB_WIDE_PHRASES: Record<number, string> = {
  14: "haul away debris",
  17: "apply foam treatment",
  18: "use additional trailers for debris removal",
};

/** Items that mean "remove the tree entirely" — different sentence shape. */
const REMOVAL_IDS = new Set([11, 12]);

/** Items that mean "leave the wood/firewood" — handled at end of clause. */
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

/** Decide whether a note reads as a short qualifier vs a full sentence. */
function isInlineNote(note: string): boolean {
  const trimmed = note.trim();
  if (!trimmed) return false;
  if (trimmed.length > 60) return false;
  // Sentence-style notes have terminal punctuation
  if (/[.!?]$/.test(trimmed)) return false;
  // Multiple sentences definitely aren't inline
  if (/[.!?]\s/.test(trimmed)) return false;
  return true;
}

function treeNoun(tree: Tree, fallbackIndex: number): string {
  const label = tree.label?.trim();
  if (label) return label;
  return `Tree ${fallbackIndex + 1}`;
}

function buildSingleTreeSentence(tree: Tree, fallbackIndex: number): string {
  const scope = tree.scopeItems ?? [];
  const note = tree.notes?.trim() ?? "";
  const inlineNote = isInlineNote(note) ? note : "";
  const trailingNote = note && !inlineNote ? note : "";

  const noun = treeNoun(tree, fallbackIndex);

  // Removal sentence: "Remove front yard pecan to ground level."
  const removalIds = scope.filter((id) => REMOVAL_IDS.has(id));
  if (removalIds.length > 0) {
    let sentence = `Remove ${noun}`;
    if (inlineNote) sentence += ` ${inlineNote}`;
    sentence += ` to ground level.`;
    if (trailingNote) sentence += `\n${capitalizeFirst(trailingNote)}.`;
    return sentence;
  }

  // Per-tree clauses (everything except job-wide and trailing)
  const treeIds = scope.filter(
    (id) => SCOPE_VERB_PHRASES[id] && !TRAILING_IDS.has(id)
  );
  const trailingIds = scope.filter((id) => TRAILING_IDS.has(id));

  const phrases = treeIds.map((id) => SCOPE_VERB_PHRASES[id]);
  const trailingPhrases = trailingIds.map((id) => SCOPE_VERB_PHRASES[id]);

  if (phrases.length === 0 && trailingPhrases.length === 0) {
    // No actionable per-tree scope — fall back to a short stub
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
    sentence += `\n${capitalizeFirst(trailingNote)}.`;
  }

  return capitalizeFirst(sentence);
}

/**
 * Group trees that share identical scope AND have similar labels.
 * Returns groups where each group is either a single tree or a collapsed bundle.
 */
type TreeGroup = {
  trees: Tree[];
  // Index of the first tree in the original array (used as fallback label)
  firstIndex: number;
};

function groupCollapsibleTrees(trees: Tree[]): TreeGroup[] {
  const groups: TreeGroup[] = [];
  const used = new Set<number>();

  for (let i = 0; i < trees.length; i++) {
    if (used.has(i)) continue;
    const tree = trees[i];
    const group: TreeGroup = { trees: [tree], firstIndex: i };
    used.add(i);

    // Collapse only if THIS tree has no notes and a label
    // (otherwise it's not safe to assume the bundle reads correctly)
    const baseLabel = tree.label?.trim() ?? "";
    const baseScope = JSON.stringify([...tree.scopeItems].sort());
    const baseNote = tree.notes?.trim() ?? "";

    if (!baseLabel || baseNote) {
      groups.push(group);
      continue;
    }

    // Find label root — drop leading direction words to compare across "back left" / "back right"
    const labelWords = baseLabel.toLowerCase().split(/\s+/);
    // Look for trees with same scope, no notes, and labels sharing the trailing noun
    for (let j = i + 1; j < trees.length; j++) {
      if (used.has(j)) continue;
      const other = trees[j];
      const otherLabel = other.label?.trim() ?? "";
      const otherNote = other.notes?.trim() ?? "";
      const otherScope = JSON.stringify([...other.scopeItems].sort());
      if (!otherLabel || otherNote) continue;
      if (otherScope !== baseScope) continue;

      const otherWords = otherLabel.toLowerCase().split(/\s+/);
      // Heuristic: share the last noun (e.g. "live oak" or "oak") AND a common
      // direction prefix family. We'll just check if the LAST word matches.
      const lastA = labelWords[labelWords.length - 1];
      const lastB = otherWords[otherWords.length - 1];
      if (lastA && lastA === lastB) {
        group.trees.push(other);
        used.add(j);
      }
    }

    groups.push(group);
  }

  return groups;
}

function buildGroupSentence(group: TreeGroup): string {
  if (group.trees.length === 1) {
    return buildSingleTreeSentence(group.trees[0], group.firstIndex);
  }

  // Collapsed group: "Trim 2 back live oaks to clear from roof only."
  const first = group.trees[0];
  const scope = first.scopeItems ?? [];
  const treeIds = scope.filter(
    (id) => SCOPE_VERB_PHRASES[id] && !TRAILING_IDS.has(id) && !REMOVAL_IDS.has(id)
  );
  const trailingIds = scope.filter((id) => TRAILING_IDS.has(id));
  const phrases = treeIds.map((id) => SCOPE_VERB_PHRASES[id]);
  const trailingPhrases = trailingIds.map((id) => SCOPE_VERB_PHRASES[id]);

  // Pluralize the noun naively — last word + s, with common arborist plural rules
  const labelWords = (first.label ?? "").trim().split(/\s+/);
  const lastWord = labelWords[labelWords.length - 1] ?? "tree";
  const pluralLast = lastWord.endsWith("s") ? lastWord : `${lastWord}s`;
  const restWords = labelWords.slice(0, -1);
  // Drop direction-specific words (front/back/left/right/side) from the front
  // so "back left live" becomes just "live" — keeps the plural reading natural
  const directionalWords = new Set([
    "front",
    "back",
    "rear",
    "left",
    "right",
    "side",
  ]);
  const meaningfulRest = restWords.filter(
    (w) => !directionalWords.has(w.toLowerCase())
  );
  // Use the originals (with directions) but only if all trees share them
  const allShareDirectionPrefix = group.trees.every((t) => {
    const lw = (t.label ?? "").trim().split(/\s+/);
    const rest = lw.slice(0, -1).join(" ").toLowerCase();
    const otherRest = restWords.join(" ").toLowerCase();
    return rest === otherRest;
  });

  const nounParts = allShareDirectionPrefix
    ? [...restWords, pluralLast]
    : [...meaningfulRest, pluralLast];
  const noun = `${group.trees.length} ${nounParts.join(" ")}`;

  let sentence = `Trim ${noun}`;
  if (phrases.length > 0) {
    sentence += ` to ${joinPhrases(phrases)}`;
    if (trailingPhrases.length > 0) {
      sentence += `; ${joinPhrases(trailingPhrases)}`;
    }
    sentence += " only.";
  } else if (trailingPhrases.length > 0) {
    sentence += `; ${joinPhrases(trailingPhrases)}.`;
  } else {
    sentence += `.`;
  }

  return capitalizeFirst(sentence);
}

/** Collect job-wide phrases (debris haul, foam, etc.) across all trees. */
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

/** Per-tree write-up — used for individual edit views or single-tree outputs. */
export function generateTreeWriteUp(tree: Tree): string {
  return buildSingleTreeSentence(tree, 0);
}

/** Combine all tree write-ups into a single estimate document. */
export function generateFullEstimateWriteUp(trees: Tree[]): string {
  if (trees.length === 0) return "";

  const groups = groupCollapsibleTrees(trees);
  const lines = groups.map((g) => buildGroupSentence(g)).filter(Boolean);

  const jobWide = buildJobWideLine(trees);
  if (jobWide) lines.push(jobWide);

  return lines.join("\n");
}

export function resolveEstimateWriteUp(
  estimate: Estimate | undefined,
  trees: Tree[]
): string {
  const override = estimate?.writeUp?.trim();
  if (override) return override;
  return generateFullEstimateWriteUp(trees);
}