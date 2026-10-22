import { create } from "zustand";
import type { Battery, Reading } from "./types";

const API = "/api";
export const POLL_MS = 2000;
export const HISTORY = 90; // 3 real minutes = 3 simulated hours

type Status = "loading" | "live" | "error";

type State = {
  fleet: Battery[];
  history: Reading[]; // selected pack, oldest -> newest
  selectedId: number | null;
  status: Status;
  updatedAt: number | null;
  select: (id: number) => void;
  tick: () => Promise<void>;
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

const fetchHistory = (id: number) =>
  fetch(`${API}/batteries/${id}/readings?limit=${HISTORY}`)
    .then((r) => json<Reading[]>(r))
    .then((rows) => rows.reverse());

let inFlight = false;

export const useTelemetry = create<State>((set, get) => ({
  fleet: [],
  history: [],
  selectedId: null,
  status: "loading",
  updatedAt: null,

  select: async (id) => {
    if (id === get().selectedId) return;
    set({ selectedId: id, history: [] });
    const rows = await fetchHistory(id).catch(() => []);
    if (get().selectedId === id) set({ history: rows }); // ignore if user clicked away meanwhile
  },

  tick: async () => {
    if (inFlight || document.visibilityState === "hidden") return; // no overlapping or background polls
    inFlight = true;
    try {
      // one request polls the whole fleet; the server throttles so many viewers = one reading per tick
      const fleet = await fetch(`${API}/poll`, { method: "POST" }).then((r) => json<Battery[]>(r));
      const id = get().selectedId ?? fleet[0]?.id ?? null;
      const history = id ? await fetchHistory(id) : [];
      if (get().selectedId !== null && get().selectedId !== id) return;
      set({ fleet, history, selectedId: id, status: "live", updatedAt: Date.now() });
    } catch {
      set({ status: "error" });
    } finally {
      inFlight = false;
    }
  },
}));
