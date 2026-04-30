import { create } from "zustand";
import { Estimate, Tree } from "@/types";
import {
  createEstimate as dbCreateEstimate,
  getAllEstimates,
  addTree as dbAddTree,
  getTreesForEstimate,
  updateTree as dbUpdateTree,
} from "./db";

type StoreState = {
  activeEstimateId: string | null;
  estimates: Estimate[];
  activeTrees: Tree[];

  setActiveEstimate: (id: string | null) => void;
  createEstimate: () => Promise<Estimate>;
  loadEstimates: () => Promise<void>;

  addTreeToEstimate: (tree: Tree) => Promise<void>;
  loadTreesForActiveEstimate: () => Promise<void>;
  updateTree: (id: string, changes: Partial<Tree>) => Promise<void>;
};

export const useAppStore = create<StoreState>((set, get) => ({
  activeEstimateId: null,
  estimates: [],
  activeTrees: [],

  setActiveEstimate: (id) => {
    set({ activeEstimateId: id, activeTrees: [] });
  },

  createEstimate: async () => {
    const estimate = await dbCreateEstimate();
    set((state) => ({
      estimates: [estimate, ...state.estimates],
      activeEstimateId: estimate.id,
      activeTrees: [],
    }));
    return estimate;
  },

  loadEstimates: async () => {
    const estimates = await getAllEstimates();
    set({ estimates });
  },

  addTreeToEstimate: async (tree) => {
    await dbAddTree(tree);
    set((state) => ({ activeTrees: [...state.activeTrees, tree] }));
  },

  loadTreesForActiveEstimate: async () => {
    const id = get().activeEstimateId;
    if (!id) {
      set({ activeTrees: [] });
      return;
    }
    const trees = await getTreesForEstimate(id);
    set({ activeTrees: trees });
  },

  updateTree: async (id, changes) => {
    await dbUpdateTree(id, changes);
    set((state) => ({
      activeTrees: state.activeTrees.map((t) =>
        t.id === id ? { ...t, ...changes } : t
      ),
    }));
  },
}));