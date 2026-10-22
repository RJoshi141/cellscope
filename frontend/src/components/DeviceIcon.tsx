import type { Battery } from "../types";

export type DeviceKind = "laptop" | "phone";

// multi-cell packs are laptop batteries; single-cell are phone batteries
export const deviceKind = (b: Battery): DeviceKind => (b.series_cells > 1 ? "laptop" : "phone");

// original thin-line glyphs (not SF Symbols, which are licensed for Apple-platform apps only)
export function DeviceIcon({ kind, size = 22 }: { kind: DeviceKind; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={kind === "laptop" ? "Laptop battery" : "Phone battery"}>
      {kind === "laptop" ? (
        <>
          <rect x="4" y="5" width="16" height="11" rx="1.6" />
          <path d="M2 18.5h20" />
          <path d="M10 18.5h4" strokeWidth="2.2" opacity=".35" />
        </>
      ) : (
        <>
          <rect x="7" y="2.5" width="10" height="19" rx="2.6" />
          <rect x="10.4" y="4.6" width="3.2" height="1.1" rx=".55" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}
