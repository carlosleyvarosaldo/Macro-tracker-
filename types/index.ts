export type User = {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: number;
};

export type Tree = {
  id: string;
  estimateId: string;
  /** @deprecated kept for backward compatibility — read from images[0] going forward */
  image?: string;
  images: string[];
  imageUrl?: string;
  label?: string;
  price: number;
  scopeItems: number[];
  notes: string;
  dbh?: number;
  height?: number;
  lat: number;
  lng: number;
  createdAt: number;
};

export type Estimate = {
  id: string;
  userId?: string;
  trees: Tree[];
  name?: string;
  address?: string;
  writeUp?: string;
  createdAt: number;
  status: "draft" | "done";
};