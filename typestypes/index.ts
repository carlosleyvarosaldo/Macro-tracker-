export type Tree = {
  id: string;
  estimateId: string;       // NEW: foreign key
  image: string;            // base64 JPEG
  price: number;
  scopeCount: number;
  notes: string;
  lat: number;
  lng: number;
  createdAt: number;
};

export type Estimate = {
  id: string;
  trees: Tree[];            // legacy field, kept for type compat (unused after v2)
  createdAt: number;
  status: "draft" | "done";
};
