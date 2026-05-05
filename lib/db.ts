import Dexie, { Table } from "dexie";
import { Estimate, Tree, User } from "@/types";

class ArboristDB extends Dexie {
  estimates!: Table<Estimate, string>;
  trees!: Table<Tree, string>;
  users!: Table<User, string>;

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
    this.version(5).stores({
      estimates: "id, createdAt, status",
      trees: "id, estimateId, createdAt",
    });

    // v6: introduce users table; add userId index to estimates
    this.version(6).stores({
      estimates: "id, userId, createdAt, status",
      trees: "id, estimateId, createdAt",
      users: "id, &email, createdAt",
    });
  }
}

export const db = new ArboristDB();

/** Migrate old single-image trees to images: string[] on read. */
function normalizeTree(raw: Tree): Tree {
  if (raw.images && raw.images.length > 0) return raw;
  if (raw.image) return { ...raw, images: [raw.image] };
  return { ...raw, images: [] };
}

// --- Users ---

export async function getUserByEmail(email: string): Promise<User | undefined> {
  return db.users.where("email").equals(email.toLowerCase().trim()).first();
}

export async function addUser(user: User): Promise<void> {
  await db.users.add(user);
}

export async function getUserById(id: string): Promise<User | undefined> {
  return db.users.get(id);
}

/**
 * One-time migration: when the first user logs in, claim all estimates
 * that don't yet have a userId. Idempotent — safe to call repeatedly.
 */
export async function claimOrphanedEstimates(userId: string): Promise<number> {
  const orphans = await db.estimates
    .filter((e) => !e.userId)
    .toArray();
  if (orphans.length === 0) return 0;
  await db.transaction("rw", db.estimates, async () => {
    for (const e of orphans) {
      await db.estimates.update(e.id, { userId });
    }
  });
  return orphans.length;
}

// --- Estimates ---

export async function createEstimate(userId: string): Promise<Estimate> {
  const estimate: Estimate = {
    id: crypto.randomUUID(),
    userId,
    trees: [],
    createdAt: Date.now(),
    status: "draft",
  };
  await db.estimates.add(estimate);
  return estimate;
}

export async function getEstimatesForUser(userId: string): Promise<Estimate[]> {
  return db.estimates
    .where("userId")
    .equals(userId)
    .reverse()
    .sortBy("createdAt")
    .then((arr) => arr.reverse()); // newest first
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
  const trees = await db.trees
    .where("estimateId")
    .equals(estimateId)
    .sortBy("createdAt");
  return trees.map(normalizeTree);
}

export async function getTreeById(id: string): Promise<Tree | undefined> {
  const tree = await db.trees.get(id);
  return tree ? normalizeTree(tree) : undefined;
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

export async function deleteEstimateCascade(id: string): Promise<void> {
  await db.transaction("rw", db.estimates, db.trees, async () => {
    await db.trees.where("estimateId").equals(id).delete();
    await db.estimates.delete(id);
  });
}