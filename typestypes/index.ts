export type Tree = {
  id: string;
  image: string;
  price: number;
  scopeCount: number;
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
