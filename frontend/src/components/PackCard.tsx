import { packState, volts } from "../format";
import type { Battery } from "../types";
import { BatteryGlyph } from "./BatteryGlyph";
import { StatusPill } from "./StatusPill";

type Props = { battery: Battery; selected: boolean; onSelect: () => void };

export function PackCard({ battery: b, selected, onSelect }: Props) {
  const r = b.latest;
  return (
    <button className="card pack" aria-pressed={selected} onClick={onSelect}>
      <div className="pack-top">
        <div>
          <div className="pack-name">{b.name}</div>
          <div className="pack-serial mono">{b.serial}</div>
        </div>
        <StatusPill {...packState(r)} />
      </div>
      <div className="pack-soc">
        <div className="big">
          {r ? r.soc_pct : "–"}
          <span>%</span>
        </div>
        <BatteryGlyph soc={r?.soc_pct ?? 0} charging={!!r?.charging} width={52} />
      </div>
      <div className="pack-foot">
        <span>
          <b className="num">{r ? volts(r.voltage_mv) : "–"}</b> V
        </span>
        <span>
          <b className="num">{r ? r.temp_c.toFixed(1) : "–"}</b> °C
        </span>
        <span>
          Health <b className="num">{r ? Math.round(r.health_pct) : "–"}%</b>
        </span>
      </div>
    </button>
  );
}
