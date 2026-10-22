import { packState } from "../format";
import type { Battery } from "../types";
import { BatteryGlyph } from "./BatteryGlyph";
import { DeviceIcon, deviceKind } from "./DeviceIcon";
import { StatusPill } from "./StatusPill";

type Props = { battery: Battery; selected: boolean; onSelect: () => void };

export function PackCard({ battery: b, selected, onSelect }: Props) {
  const r = b.latest;
  return (
    <button className="card pack" aria-pressed={selected} onClick={onSelect}>
      <div className="pack-top">
        <span className="pack-icon"><DeviceIcon kind={deviceKind(b)} /></span>
        <span className="pack-name">{b.name}</span>
      </div>
      <div className="pack-soc">
        <div className="big">
          {r ? r.soc_pct : "–"}
          <span>%</span>
        </div>
        <BatteryGlyph soc={r?.soc_pct ?? 0} charging={!!r?.charging} width={46} />
      </div>
      <div className="pack-foot">
        <StatusPill {...packState(r)} />
        <span>Health <b className="num">{r ? Math.round(r.health_pct) : "–"}%</b></span>
      </div>
    </button>
  );
}
