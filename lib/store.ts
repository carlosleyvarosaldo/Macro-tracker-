import { create } from "zustand";
import { Estimate } from "@/types";
import {
  createEstimate as dbCreateEstimate,
  getAllEstimates,
} from "./db";

type StoreState = {
  activeEstimateId: string | null;
  estimates: Estimate[];
  setActiveEstimate: (id: string | null) => void;
  createEstimate: () => Promise<Estimate>;
  loadEstimates: () => Promise<void>;
};

export const useAppStore = create<StoreState>((set) => ({
  activeEstimateId: null,
  estimates: [],

  setActiveEstimate: (id) => set({ activeEstimateId: id }),

  createEstimate: async () => {
    const estimate = await dbCreateEstimate();
    set((state) => ({
      estimates: [estimate, ...state.estimates],
      activeEstimateId: estimate.id,
    }));
    return estimate;
  },

  loadEstimates: async () => {
    const estimates = await getAllEstimates();
    set({ estimates });
  },
}));
