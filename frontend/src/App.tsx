import { useEffect, useMemo } from "react";
import { BatteryGlyph } from "./components/BatteryGlyph";
import { HowItWorks } from "./components/HowItWorks";
import { ReadingLog } from "./components/ReadingLog";
import { MetricChart, type Point } from "./components/MetricChart";
import { PackCard } from "./components/PackCard";
import { PackSpec } from "./components/PackSpec";
import { RegisterInspector } from "./components/RegisterInspector";
import { StatRow } from "./components/StatRow";
import { DeviceIcon, deviceKind } from "./components/DeviceIcon";
import { OVER_TEMP_C, signed, WARM_C } from "./format";
import { HISTORY, POLL_MS, useTelemetry } from "./store";
import type { Reading } from "./types";

const REPO = "https://github.com/RJoshi141/cellscope";
const PORTFOLIO = "https://rjoshi141.github.io/portfolio-v2/#/work/cellscope";

// x is simulated time: idle gaps are capped exactly like the backend's MAX_GAP,
// so a quiet hour of nobody watching doesn't stretch the axis
const MAX_GAP_MS = 30_000;
const series = (rows: Reading[], pick: (r: Reading) => number): Point[] => {
  let t = 0;
  return rows.map((r, i) => {
    const real = Date.parse(r.ts);
    if (i > 0) t += Math.min(real - Date.parse(rows[i - 1].ts), MAX_GAP_MS);
    return { t, v: pick(r), real };
  });
};

// pick the smallest "nice" step that gives at most 5 intervals, so ticks land on even numbers
function niceScale(values: number[], include: number[] = []) {
  const all = [...values, ...include];
  if (!all.length) return { domain: [0, 1] as [number, number], ticks: [0, 1] };
  const min = Math.min(...all), max = Math.max(...all);
  const step = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10].find((s) => Math.ceil(max / s) - Math.floor(min / s) <= 5) ?? 10;
  const lo = Math.floor(min / step) * step, hi = Math.max(Math.ceil(max / step) * step, lo + step);
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => +(lo + i * step).toFixed(2));
  return { domain: [lo, hi] as [number, number], ticks };
}

export default function App() {
  const { fleet, history, selectedId, status, select, tick } = useTelemetry();

  useEffect(() => {
    tick();
    const t = setInterval(tick, POLL_MS);
    const wake = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [tick]);

  const selected = fleet.find((b) => b.id === selectedId) ?? null;
  // history's newest row carries the raw register words
  const latest = history.length ? history[history.length - 1] : selected?.latest ?? null;

  const charts = useMemo(() => {
    const voltage = series(history, (r) => r.voltage_mv / 1000);
    const current = series(history, (r) => r.current_ma / 1000);
    return {
      soc: series(history, (r) => r.soc_pct),
      voltage,
      current,
      temp: series(history, (r) => r.temp_c),
      vScale: niceScale(voltage.map((p) => p.v)),
      iScale: niceScale(current.map((p) => p.v), [0]), // keep the zero line in view
    };
  }, [history]);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <BatteryGlyph soc={72} charging={false} width={26} label={false} />
            CellScope
            <small className="hide-sm">Battery telemetry</small>
          </div>
          <nav className="topbar-meta">
            <span className="live" data-status={status} role="status">
              <span className="live-dot" />
              {status === "error" ? "Offline" : status === "loading" ? "Connecting" : "Live"}
            </span>
            <a href={PORTFOLIO} className="hide-sm">Case study</a>
            <a href={REPO}>GitHub</a>
          </nav>
        </div>
      </header>

      <main className="shell">
        <section className="hero">
          <h1>Battery telemetry, live.</h1>
          <p>
            Reads the registers a battery's gas-gauge chip reports over SMBus, decodes them, and charts each battery as
            it charges, drains, heats up and wears. Simulated at 60× real time. <a href="#how-it-works">How it works</a>
          </p>
        </section>

        {status === "error" && (
          <div className="banner" role="alert">Can't reach the telemetry API. Retrying every {POLL_MS / 1000}s.</div>
        )}

        <div className="fleet" style={{ marginTop: 8 }}>
          {fleet.length
            ? fleet.map((b) => (
                <PackCard key={b.id} battery={b} selected={b.id === selectedId} onSelect={() => select(b.id)} />
              ))
            : Array.from({ length: 4 }, (_, i) => <div key={i} className="card skeleton" style={{ height: 156 }} />)}
        </div>

        {selected && (
          <>
            <div className="detail-head">
              <div className="detail-title">
                <span className="detail-icon"><DeviceIcon kind={deviceKind(selected)} size={28} /></span>
                <div>
                  <h2>{selected.name}</h2>
                  <div className="detail-sub">
                    {selected.series_cells}S Li-ion · {selected.design_capacity_mah.toLocaleString()} mAh ·{" "}
                    <span className="mono">{selected.serial}</span>
                  </div>
                </div>
              </div>
            </div>

            <StatRow reading={latest} />

            <div className="section-head">
              <h2>History</h2>
              <span className="aside">Last {HISTORY} readings</span>
            </div>
            <div className="charts" style={{ marginTop: 0 }}>
              <MetricChart
                title="State of charge" unit="%" data={charts.soc} format={(v) => v.toFixed(0)}
                domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} area baseline={0}
              />
              <MetricChart
                title="Voltage" unit="V" data={charts.voltage} format={(v) => v.toFixed(2)}
                domain={charts.vScale.domain} ticks={charts.vScale.ticks}
              />
              <MetricChart
                title="Current" unit="A" data={charts.current} format={(v) => signed(v, 1)}
                domain={charts.iScale.domain} ticks={charts.iScale.ticks} area baseline={0}
              />
              <MetricChart
                title="Temperature" unit="°C" data={charts.temp} format={(v) => v.toFixed(0)}
                domain={[20, 50]} ticks={[20, 30, 40, 50]}
                refs={[
                  { y: WARM_C, label: "Warm", tone: "warning" },
                  { y: OVER_TEMP_C, label: "Over-temp alarm", tone: "critical" },
                ]}
              />
            </div>

            <div className="split">
              <RegisterInspector reading={latest} />
              <PackSpec battery={{ ...selected, latest }} />
            </div>
          </>
        )}

        {selected && (
          <>
            <div className="section-head">
              <h2>Reading log</h2>
              <span className="aside">Newest first</span>
            </div>
            <div className="grid-wrap">
              <ReadingLog history={history} />
            </div>
          </>
        )}

        <HowItWorks repo={REPO} />

        <footer className="footer">
          <span>Built by Ritika Joshi</span>
          <a href={REPO}>Source on GitHub</a>
        </footer>
      </main>
    </>
  );
}
