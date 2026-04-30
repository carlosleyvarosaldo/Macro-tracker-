export type ScopeOption = { id: number; label: string };

export const SCOPE_OPTIONS: ScopeOption[] = [
  { id: 1, label: "Prune Dead Wood" },
  { id: 2, label: "Remove Ball Moss / Mistletoe" },
  { id: 3, label: "Remove Sprouts" },
  { id: 4, label: "Remove Broken Limbs" },
  { id: 5, label: "Remove Vines / Cut Vines" },
  { id: 6, label: "Take Weight Off" },
  { id: 7, label: "Thin Out Canopy / Limbs" },
  { id: 8, label: "Raise Canopy" },
  { id: 9, label: "Clear Roof / Property Line" },
  { id: 10, label: "Shape Shrubs" },
  { id: 11, label: "Remove Tree to Ground" },
  { id: 12, label: "Remove Shrubs to Ground" },
  { id: 13, label: "Leave Firewood / Stack" },
  { id: 14, label: "Haul Away Debris" },
  { id: 15, label: "Leave Wood Curbside" },
  { id: 16, label: "Cut and Drop Wood" },
  { id: 17, label: "Foam (cans needed)" },
  { id: 18, label: "Extra Trailers" },
  { id: 19, label: "Cable" },
];

// O(1) lookup for rendering labels from saved IDs
const SCOPE_BY_ID = new Map(SCOPE_OPTIONS.map((o) => [o.id, o]));

export function getScopeLabel(id: number): string {
  return SCOPE_BY_ID.get(id)?.label ?? `Unknown (${id})`;
}