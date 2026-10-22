import type { Battery } from "../types";

const PROFILE_LABEL = { light: "Light load", standard: "Standard load", heavy: "Heavy load" };

export function PackSpec({ battery: b }: { battery: Battery }) {
  const r = b.latest;
  const items = [
    ["Configuration", `${b.series_cells}S Li-ion`],
    ["Usage profile", PROFILE_LABEL[b.profile]],
    ["Design capacity", `${b.design_capacity_mah.toLocaleString()} mAh`],
    ["Full charge capacity", r ? `${r.full_charge_mah.toLocaleString()} mAh` : "–"],
    ["Remaining", r ? `${r.remaining_mah.toLocaleString()} mAh` : "–"],
    ["Cycles", r ? r.cycle_count.toLocaleString() : "–"],
  ];
  return (
    <section className="card card-pad" aria-labelledby="spec-title">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 id="spec-title" style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Battery health</h3>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }} className="num">
          {r ? `${r.health_pct.toFixed(1)}%` : "–"}
        </span>
      </div>
      <div className="health-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r?.health_pct ?? 0} aria-label="Battery health">
        <div style={{ width: `${r?.health_pct ?? 0}%` }} />
      </div>
      <p className="muted" style={{ fontSize: 12, margin: "10px 0 6px" }}>
        Full charge capacity relative to design capacity. Fades with every cycle.
      </p>
      <dl className="spec" style={{ margin: 0 }}>
        {items.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {r && <CapacityBar design={b.design_capacity_mah} full={r.full_charge_mah} remaining={r.remaining_mah} />}
    </section>
  );
}

// where the design capacity went: charge left, room to charge, and capacity lost to wear
function CapacityBar({ design, full, remaining }: { design: number; full: number; remaining: number }) {
  const parts = [
    { key: "Charge", mah: remaining, cls: "cap-charge" },
    { key: "Empty", mah: full - remaining, cls: "cap-empty" },
    { key: "Lost to wear", mah: design - full, cls: "cap-lost" },
  ];
  return (
    <div className="cap" aria-label="Capacity breakdown">
      <div className="eyebrow" style={{ marginBottom: 8 }}>Capacity breakdown</div>
      <div className="cap-bar">
        {parts.map((p) =>
          p.mah > 0 ? <div key={p.key} className={p.cls} style={{ flexGrow: p.mah }} title={`${p.key}: ${p.mah.toLocaleString()} mAh`} /> : null,
        )}
      </div>
      <div className="cap-legend">
        {parts.map((p) => (
          <span key={p.key}>
            <i className={p.cls} />
            {p.key} <b className="num">{p.mah.toLocaleString()}</b> mAh
          </span>
        ))}
      </div>
    </div>
  );
}
