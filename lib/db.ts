import Dexie, { Table } from "dexie";
import { Estimate, Tree } from "@/types";

class ArboristDB extends Dexie {
  estimates!: Table<Estimate, string>;
  trees!: Table<Tree, string>;

  constructor() {
    super("ArboristDB");

    // v1: original schema
    this.version(1).stores({
      estimates: "id, createdAt, status",
      trees: "id, createdAt",
    });

    // v2: index trees by estimateId for fast lookup
    this.version(2).stores({
      estimates: "id, createdAt, status",
      trees: "id, estimateId, createdAt",
    });
  }
}

export const db = new ArboristDB();

// --- Estimates ---

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

// --- Trees ---

export async function addTree(tree: Tree): Promise<void> {
  await db.trees.add(tree);
}

export async function getTreesForEstimate(estimateId: string): Promise<Tree[]> {
  return db.trees.where("estimateId").equals(estimateId).sortBy("createdAt");
}
