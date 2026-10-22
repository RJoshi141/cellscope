import type { Reading } from "./types";

const MINUS = "−"; // typographic minus, not a hyphen

export const signed = (n: number, digits: number) =>
  `${n < 0 ? MINUS : n > 0 ? "+" : ""}${Math.abs(n).toFixed(digits)}`;

export const volts = (mv: number) => (mv / 1000).toFixed(2);
export const amps = (ma: number) => signed(ma / 1000, 2);
export const watts = (w: number) => signed(w, 1);
export const celsius = (c: number) => c.toFixed(1);
export const hex16 = (w: number) => `0x${w.toString(16).toUpperCase().padStart(4, "0")}`;
export const clock = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function duration(min: number | null) {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  return h ? `${h}h ${String(min % 60).padStart(2, "0")}m` : `${min}m`;
}

export const WARM_C = 35;
export const OVER_TEMP_C = 45;
export const LOW_PCT = 20;

export type PackState = { label: string; tone: "good" | "neutral" | "warning" | "critical" };

// one status per pack, most severe wins
export function packState(r: Reading | null): PackState {
  if (!r) return { label: "Waiting", tone: "neutral" };
  if (r.over_temp) return { label: "Over temp", tone: "critical" };
  if (r.charging) return { label: r.soc_pct >= 80 ? "Topping off" : "Charging", tone: "good" };
  if (r.soc_pct <= LOW_PCT) return { label: "Low", tone: "critical" };
  if (r.temp_c >= WARM_C) return { label: "Warm", tone: "warning" };
  return { label: "On battery", tone: "neutral" };
}

// simulated time before the newest reading (SIM_SPEED = 60: 1 real second = 1 sim minute)
export function simAgo(t: number, now: number) {
  const min = Math.round((now - t) / 1000);
  if (min <= 0) return "now";
  const h = Math.floor(min / 60);
  return `${h ? `${h}h ` : ""}${min % 60}m ago`;
}
