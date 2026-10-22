import { create } from "zustand";
import type { Battery, Reading } from "./types";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:5001/api";
const HOT_C = 33; // flag packs running warm

type State = {
  batteries: Battery[];
  readings: Record<number, Reading[]>;
  selectedId: number | null;
  error: string | null;
  select: (id: number) => void;
  tick: () => Promise<void>;
};

export const isHot = (r: Reading | null) => !!r && r.temp_c >= HOT_C;

export const useBatteries = create<State>((set, get) => ({
  batteries: [],
  readings: {},
  selectedId: null,
  error: null,
  select: (id) => set({ selectedId: id }),

  // poll every pack, then refresh list + history in one state update
  tick: async () => {
    try {
      const list: Battery[] = await fetch(`${API}/batteries`).then((r) => r.json());
      await Promise.all(
        list.map((b) => fetch(`${API}/batteries/${b.id}/poll`, { method: "POST" })),
      );
      const [fresh, ...hist] = await Promise.all([
        fetch(`${API}/batteries`).then((r) => r.json() as Promise<Battery[]>),
        ...list.map((b) =>
          fetch(`${API}/batteries/${b.id}/readings?limit=60`).then(
            (r) => r.json() as Promise<Reading[]>,
          ),
        ),
      ]);
      set({
        batteries: fresh,
        readings: Object.fromEntries(list.map((b, i) => [b.id, hist[i]])),
        selectedId: get().selectedId ?? fresh[0]?.id ?? null,
        error: null,
      });
    } catch {
      set({ error: "Can't reach the API. Is the backend running on :5001?" });
    }
  },
}));
