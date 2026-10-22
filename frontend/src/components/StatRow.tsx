import { amps, celsius, duration, volts, watts, WARM_C } from "../format";
import type { Reading } from "../types";

type Stat = { label: string; value: string; unit?: string; note: string };

function stats(r: Reading): Stat[] {
  const time = r.charging
    ? { label: "Time to full", value: duration(r.time_to_full_min), note: "AverageTimeToFull · sim time" }
    : { label: "Time to empty", value: duration(r.time_to_empty_min), note: "RunTimeToEmpty · sim time" };
  return [
    { label: "Voltage", value: volts(r.voltage_mv), unit: "V", note: "Pack terminal voltage" },
    { label: "Current", value: amps(r.current_ma), unit: "A", note: r.current_ma >= 0 ? "Into the pack" : "Out of the pack" },
    { label: "Power", value: watts(r.power_w), unit: "W", note: "V × I" },
    { label: "Temperature", value: celsius(r.temp_c), unit: "°C", note: r.temp_c >= WARM_C ? "Running warm" : "Within normal range" },
    time,
    { label: "Cycle count", value: String(r.cycle_count), note: "Completed charge cycles" },
  ];
}

export function StatRow({ reading }: { reading: Reading | null }) {
  return (
    <div className="card stats" aria-live="off">
      {reading
        ? stats(reading).map((s) => (
            <div className="stat" key={s.label}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">
                {s.value}
                {s.unit && <small>{s.unit}</small>}
              </div>
              <div className="stat-note">{s.note}</div>
            </div>
          ))
        : Array.from({ length: 6 }, (_, i) => (
            <div className="stat" key={i}>
              <div className="skeleton" style={{ height: 12, width: 70 }} />
              <div className="skeleton" style={{ height: 26, width: 90, marginTop: 10 }} />
            </div>
          ))}
    </div>
  );
}
