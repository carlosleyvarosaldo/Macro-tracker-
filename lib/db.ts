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

    this.version(2).stores({
      estimates: "id, createdAt, status",
      trees: "id, estimateId, createdAt",
    });

    this.version(3).stores({
      estimates: "id, createdAt, status",
      trees: "id, estimateId, createdAt",
    });

    this.version(4).stores({
      estimates: "id, createdAt, status",
      trees: "id, estimateId, createdAt",
    });

    // v5: add name + address to estimate (no index needed for either)
    this.version(5).stores({
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

export async function updateEstimate(
  id: string,
  changes: Partial<Estimate>
): Promise<void> {
  await db.estimates.update(id, changes);
}

// --- Trees ---

export async function addTree(tree: Tree): Promise<void> {
  await db.trees.add(tree);
}

export async function getTreesForEstimate(estimateId: string): Promise<Tree[]> {
  return db.trees.where("estimateId").equals(estimateId).sortBy("createdAt");
}

export async function getTreeById(id: string): Promise<Tree | undefined> {
  return db.trees.get(id);
}

export async function updateTree(
  id: string,
  changes: Partial<Tree>
): Promise<void> {
  await db.trees.update(id, changes);
}

// --- Deletes ---

export async function deleteTree(id: string): Promise<void> {
  await db.trees.delete(id);
}

/** Cascade-deletes the estimate and ALL its trees in a single transaction. */
export async function deleteEstimateCascade(id: string): Promise<void> {
  await db.transaction("rw", db.estimates, db.trees, async () => {
    await db.trees.where("estimateId").equals(id).delete();
    await db.estimates.delete(id);
  });
}