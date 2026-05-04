export type Tree = {
  id: string;
  estimateId: string;
  image: string;
  imageUrl?: string;
  label?: string;
  price: number;
  scopeItems: number[];
  notes: string;
  lat: number;
  lng: number;
  createdAt: number;
};

export type Estimate = {
  id: string;
  trees: Tree[];
  writeUp?: string;
  createdAt: number;
  status: "draft" | "done";
};