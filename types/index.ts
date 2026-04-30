export type Tree = {
  id: string;
  estimateId: string;
  image: string;
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
  createdAt: number;
  status: "draft" | "done";
};
