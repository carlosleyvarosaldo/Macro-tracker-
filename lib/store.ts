import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Estimate, Tree, User } from "@/types";
import {
  createEstimate as dbCreateEstimate,
  getEstimatesForUser,
  addTree as dbAddTree,
  getTreesForEstimate,
  updateTree as dbUpdateTree,
  updateEstimate as dbUpdateEstimate,
  deleteTree as dbDeleteTree,
  deleteEstimateCascade as dbDeleteEstimate,
} from "./db";
import { loadCurrentUser, signOut as authSignOut } from "./auth";

type StoreState = {
  currentUser: User | null;
  authChecked: boolean;
  activeEstimateId: string | null;
  estimates: Estimate[];
  activeTrees: Tree[];

  bootstrapAuth: () => Promise<void>;
  setCurrentUser: (user: User | null) => void;
  signOut: () => void;

  setActiveEstimate: (id: string | null) => void;
  createEstimate: () => Promise<Estimate>;
  loadEstimates: () => Promise<void>;

  addTreeToEstimate: (tree: Tree) => Promise<void>;
  loadTreesForActiveEstimate: () => Promise<void>;
  updateTree: (id: string, changes: Partial<Tree>) => Promise<void>;
  updateEstimate: (id: string, changes: Partial<Estimate>) => Promise<void>;

  deleteTree: (id: string) => Promise<void>;
  deleteEstimate: (id: string) => Promise<void>;
};

export const useAppStore = create<StoreState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      authChecked: false,
      activeEstimateId: null,
      estimates: [],
      activeTrees: [],

      bootstrapAuth: async () => {
        const user = await loadCurrentUser();
        set({ currentUser: user, authChecked: true });
        if (user) {
          const estimates = await getEstimatesForUser(user.id);
          set({ estimates });
        }
      },

      setCurrentUser: (user) => {
        set({
          currentUser: user,
          activeEstimateId: null,
          activeTrees: [],
          estimates: [],
        });
      },

      signOut: () => {
        authSignOut();
        set({
          currentUser: null,
          activeEstimateId: null,
          activeTrees: [],
          estimates: [],
        });
      },

      setActiveEstimate: (id) => {
        set({ activeEstimateId: id, activeTrees: [] });
      },

      createEstimate: async () => {
        const user = get().currentUser;
        if (!user) throw new Error("Must be signed in to create an estimate");
        const estimate = await dbCreateEstimate(user.id);
        set((state) => ({
          estimates: [estimate, ...state.estimates],
          activeEstimateId: estimate.id,
          activeTrees: [],
        }));
        return estimate;
      },

      loadEstimates: async () => {
        const user = get().currentUser;
        if (!user) {
          set({ estimates: [] });
          return;
        }
        const estimates = await getEstimatesForUser(user.id);
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

      updateEstimate: async (id, changes) => {
        await dbUpdateEstimate(id, changes);
        set((state) => ({
          estimates: state.estimates.map((e) =>
            e.id === id ? { ...e, ...changes } : e
          ),
        }));
      },

      deleteTree: async (id) => {
        await dbDeleteTree(id);
        set((state) => ({
          activeTrees: state.activeTrees.filter((t) => t.id !== id),
        }));
      },

      deleteEstimate: async (id) => {
        await dbDeleteEstimate(id);
        set((state) => {
          const cleared = state.activeEstimateId === id;
          return {
            estimates: state.estimates.filter((e) => e.id !== id),
            activeEstimateId: cleared ? null : state.activeEstimateId,
            activeTrees: cleared ? [] : state.activeTrees,
          };
        });
      },
    }),
    {
      name: "arborist-store",
      storage: createJSONStorage(() => localStorage),
      // Only persist the active estimate id; user comes from authoritative auth check
      partialize: (state) => ({ activeEstimateId: state.activeEstimateId }),
    }
  )
);