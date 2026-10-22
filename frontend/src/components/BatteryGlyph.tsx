import { LOW_PCT } from "../format";

type Props = { soc: number; charging: boolean; width?: number; label?: boolean };

// iOS-style battery: neutral fill, green while charging, red when low
export function BatteryGlyph({ soc, charging, width = 46, label = true }: Props) {
  const pct = Math.max(0, Math.min(100, soc));
  const fill = charging ? "var(--good-fill)" : pct <= LOW_PCT ? "var(--critical-fill)" : "var(--ink)";
  const inner = 35 * (pct / 100);
  return (
    <svg
      width={width}
      height={(width * 22) / 46}
      viewBox="0 0 46 22"
      role={label ? "img" : undefined}
      aria-label={label ? `${pct}%${charging ? ", charging" : ""}` : undefined}
      aria-hidden={label ? undefined : true}
    >
      <rect x="0.75" y="0.75" width="40.5" height="20.5" rx="6" fill="none" stroke="var(--ink-4)" strokeOpacity="0.55" strokeWidth="1.5" />
      <rect x="42.5" y="7.25" width="2.75" height="7.5" rx="1.4" fill="var(--ink-4)" fillOpacity="0.55" />
      <rect x="3.5" y="3.5" width={Math.max(inner, pct > 0 ? 2.5 : 0)} height="15" rx="3.5" fill={fill} style={{ transition: "width .6s cubic-bezier(.25,.1,.25,1)" }} />
      {charging && (
        <path d="M23.6 2.6 15.4 12.6h5.4l-2.2 6.8 8.4-10.2h-5.5z" fill="var(--ink)" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
      )}
    </svg>
  );
}
