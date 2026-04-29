import Dexie, { Table } from "dexie";
import { Estimate, Tree } from "@/types";

class ArboristDB extends Dexie {
  estimates!: Table<Estimate, string>;
  trees!: Table<Tree, string>;

  constructor() {
    super("ArboristDB");
    this.version(1).stores({
      estimates: "id, createdAt, status",
      trees: "id, createdAt",
    });
  }
}

export const db = new ArboristDB();

export async function createEstimate(): Promise<Estimate> {
  const estimate: Estimate = {
    id: crypto.randomUUID(),
    trees: [],
    createdAt: Date.now(),
    status: "draft",
  };
  await db.estimates.add(estimate);
  return estimate;
}

export async function getAllEstimates(): Promise<Estimate[]> {
  return db.estimates.orderBy("createdAt").reverse().toArray();
}

export async function getEstimateById(id: string): Promise<Estimate | undefined> {
  return db.estimates.get(id);
}
