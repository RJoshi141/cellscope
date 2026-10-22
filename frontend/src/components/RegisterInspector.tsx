import { useEffect, useRef } from "react";
import { hex16 } from "../format";
import type { Reading, RegisterName } from "../types";

// Smart Battery Data Spec v1.1 registers, in the order the poller reads them
const REGISTERS: { name: RegisterName; label: string; cmd: number; decode: (w: number) => string }[] = [
  { name: "voltage", label: "Voltage", cmd: 0x09, decode: (w) => `${w.toLocaleString()} mV` },
  { name: "current", label: "Current", cmd: 0x0a, decode: (w) => `${(w & 0x8000 ? w - 0x10000 : w).toLocaleString().replace("-", "\u2212")} mA` },
  { name: "temperature", label: "Temperature", cmd: 0x08, decode: (w) => `${(w / 10 - 273.15).toFixed(1)} °C` },
  { name: "rsoc", label: "RelativeStateOfCharge", cmd: 0x0d, decode: (w) => `${w} %` },
  { name: "remaining_capacity", label: "RemainingCapacity", cmd: 0x0f, decode: (w) => `${w.toLocaleString()} mAh` },
  { name: "full_charge_capacity", label: "FullChargeCapacity", cmd: 0x10, decode: (w) => `${w.toLocaleString()} mAh` },
  { name: "run_time_to_empty", label: "RunTimeToEmpty", cmd: 0x11, decode: (w) => (w === 0xffff ? "n/a" : `${w} min`) },
  { name: "average_time_to_full", label: "AverageTimeToFull", cmd: 0x13, decode: (w) => (w === 0xffff ? "n/a" : `${w} min`) },
  { name: "cycle_count", label: "CycleCount", cmd: 0x17, decode: (w) => `${w}` },
  { name: "battery_status", label: "BatteryStatus", cmd: 0x16, decode: (w) => `0b${w.toString(2).padStart(16, "0").replace(/(.{4})/g, "$1 ").trim()}` },
];

const FLAGS = [
  { bit: 0x1000, name: "OVER_TEMP_ALARM", alarm: true },
  { bit: 0x0080, name: "INITIALIZED", alarm: false },
  { bit: 0x0040, name: "DISCHARGING", alarm: false },
  { bit: 0x0020, name: "FULLY_CHARGED", alarm: false },
  { bit: 0x0010, name: "FULLY_DISCHARGED", alarm: true },
];

// flash a cell when its raw word changes between polls
function Word({ value }: { value: number }) {
  const ref = useRef<HTMLTableCellElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value && ref.current) {
      ref.current.classList.remove("changed");
      void ref.current.offsetWidth; // restart the animation
      ref.current.classList.add("changed");
    }
    prev.current = value;
  }, [value]);
  return <td ref={ref} className="mono word">{hex16(value)}</td>;
}

export function RegisterInspector({ reading }: { reading: Reading | null }) {
  const raw = reading?.raw;
  return (
    <section className="card" aria-labelledby="regs-title">
      <div className="inspector-head">
        <h3 id="regs-title">SMBus registers</h3>
        <span className="bus-meta">addr 0x0B · read_word_data</span>
      </div>
      <div className="scroll-x">
      <table className="regs">
        <thead>
          <tr>
            <th>Register</th>
            <th>Cmd</th>
            <th>Raw word</th>
            <th>Decoded</th>
          </tr>
        </thead>
        <tbody>
          {REGISTERS.map((r) => (
            <tr key={r.name}>
              <td>{r.label}</td>
              <td className="mono cmd">0x{r.cmd.toString(16).toUpperCase().padStart(2, "0")}</td>
              {raw ? <Word value={raw[r.name]} /> : <td className="mono word">––––––</td>}
              <td className="mono">
                {raw ? (
                  r.name === "battery_status" ? (
                    <>
                      <span className="bin">{r.decode(raw[r.name])}</span>
                      <span className="bin-short">flags below</span>
                    </>
                  ) : (
                    r.decode(raw[r.name])
                  )
                ) : (
                  "–"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="flags" aria-label="BatteryStatus flags">
        {FLAGS.map((f) => (
          <span key={f.name} className="flag" data-on={!!raw && (raw.battery_status & f.bit) !== 0} data-alarm={f.alarm}>
            {f.name}
          </span>
        ))}
      </div>
    </section>
  );
}
