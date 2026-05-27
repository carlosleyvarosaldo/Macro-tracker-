export type ScopeIcon = {
  /** Single image path, or multiple if the item has several illustrations. */
  paths: string[];
};

export type ScopeOption = {
  id: number;
  label: string;
  /** Optional longer description shown below the label in the picker. */
  description?: string;
  icon: ScopeIcon;
  /** Group used to organize options in the picker. */
  group: ScopeGroup;
};

export type ScopeGroup =
  | "Trim"
  | "Remove"
  | "Wood handling"
  | "Cleanup"
  | "Equipment";

export const SCOPE_OPTIONS: ScopeOption[] = [
  {
    id: 1,
    label: "Prune Dead Wood",
    icon: { paths: ["/scope/1.jpg"] },
    group: "Trim",
  },
  {
    id: 2,
    label: "Remove Ball Moss / Mistletoe",
    icon: { paths: ["/scope/2.jpg"] },
    group: "Trim",
  },
  {
    id: 3,
    label: "Remove Sprouts",
    icon: { paths: ["/scope/3.jpg"] },
    group: "Trim",
  },
  {
    id: 4,
    label: "Remove Broken Limbs",
    icon: { paths: ["/scope/4.jpg"] },
    group: "Trim",
  },
  {
    id: 5,
    label: "Remove Vines / Cut Vines",
    icon: { paths: ["/scope/5.jpg"] },
    group: "Trim",
  },
  {
    id: 6,
    label: "Take Weight Off",
    icon: { paths: ["/scope/6.jpg"] },
    group: "Trim",
  },
  {
    id: 7,
    label: "Thin Out Canopy / Limbs",
    icon: { paths: ["/scope/7.jpg"] },
    group: "Trim",
  },
  {
    id: 8,
    label: "Raise Canopy",
    icon: { paths: ["/scope/8.jpg"] },
    group: "Trim",
  },
  {
    id: 9,
    label: "Clear Roof / Lines",
    icon: { paths: ["/scope/9.jpg"] },
    group: "Trim",
  },
  {
    id: 10,
    label: "Shape Shrubs",
    icon: { paths: ["/scope/10.jpg"] },
    group: "Trim",
  },
  {
    id: 11,
    label: "Remove tree(s) to ground",
    description: "Permit required (Cir/DBH). Reason: Dev / Dead / Diseased",
    icon: {
      paths: ["/scope/11a.jpg", "/scope/11b.jpg", "/scope/11c.jpg"],
    },
    group: "Remove",
  },
  {
    id: 12,
    label: "Remove Shrubs to ground level",
    icon: { paths: ["/scope/12.jpg"] },
    group: "Remove",
  },
  {
    id: 20,
    label: "Top Tree(s)",
    icon: { paths: ["/scope/20.jpg"] },
    group: "Remove",
  },
  {
    id: 13,
    label: "Leave Firewood / Stack",
    icon: { paths: ["/scope/13.jpg"] },
    group: "Wood handling",
  },
  {
    id: 15,
    label: "Leave wood Curbside",
    icon: { paths: ["/scope/15.jpg"] },
    group: "Wood handling",
  },
  {
    id: 16,
    label: "Cut and Drop wood",
    icon: { paths: ["/scope/16.jpg"] },
    group: "Wood handling",
  },
  {
    id: 14,
    label: "Haul away Piles of Debris",
    icon: { paths: ["/scope/14.jpg"] },
    group: "Cleanup",
  },
  {
    id: 17,
    label: "Foam (cans needed)",
    icon: { paths: ["/scope/17.jpg"] },
    group: "Cleanup",
  },
  {
    id: 18,
    label: "Extra Trailers",
    icon: { paths: ["/scope/18.jpg"] },
    group: "Equipment",
  },
  {
    id: 19,
    label: "Cable",
    icon: { paths: ["/scope/19.jpg"] },
    group: "Equipment",
  },
];

const SCOPE_GROUP_ORDER: ScopeGroup[] = [
  "Trim",
  "Remove",
  "Wood handling",
  "Cleanup",
  "Equipment",
];

export function getScopeOption(id: number): ScopeOption | undefined {
  return SCOPE_OPTIONS.find((o) => o.id === id);
}

export function getScopeLabel(id: number): string {
  return getScopeOption(id)?.label ?? `Item ${id}`;
}

export function getScopeGroupOrder(): ScopeGroup[] {
  return SCOPE_GROUP_ORDER;
}

export function getScopeOptionsByGroup(): Record<ScopeGroup, ScopeOption[]> {
  const result = {} as Record<ScopeGroup, ScopeOption[]>;
  for (const g of SCOPE_GROUP_ORDER) result[g] = [];
  for (const opt of SCOPE_OPTIONS) result[opt.group].push(opt);
  return result;
}