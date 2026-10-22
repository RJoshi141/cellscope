import { useEffect, useMemo } from "react";
import { BatteryGlyph } from "./components/BatteryGlyph";
import { FleetTable } from "./components/FleetTable";
import { MetricChart, type Point } from "./components/MetricChart";
import { PackCard } from "./components/PackCard";
import { PackSpec } from "./components/PackSpec";
import { RegisterInspector } from "./components/RegisterInspector";
import { StatRow } from "./components/StatRow";
import { StatusPill } from "./components/StatusPill";
import { OVER_TEMP_C, packState, signed, WARM_C } from "./format";
import { HISTORY, POLL_MS, useTelemetry } from "./store";
import type { Reading } from "./types";

const REPO = "https://github.com/RJoshi141/cellscope";
const PORTFOLIO = "https://rjoshi141.github.io/portfolio-v2/";

const series = (rows: Reading[], pick: (r: Reading) => number): Point[] =>
  rows.map((r) => ({ t: Date.parse(r.ts), v: pick(r) }));

// round chart bounds outward to a clean step so ticks land on readable numbers
const floorTo = (step: number, pad = 0) => (v: number) => Math.floor((v - pad) / step) * step;
const ceilTo = (step: number, pad = 0) => (v: number) => Math.ceil((v + pad) / step) * step;

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

  const charts = useMemo(
    () => ({
      soc: series(history, (r) => r.soc_pct),
      voltage: series(history, (r) => r.voltage_mv / 1000),
      current: series(history, (r) => r.current_ma / 1000),
      temp: series(history, (r) => r.temp_c),
    }),
    [history],
  );

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
            <span className="hide-sm">60× simulation</span>
            <a href={PORTFOLIO} className="hide-sm">Case study</a>
            <a href={REPO}>GitHub</a>
          </nav>
        </div>
      </header>

      <main className="shell">
        <section className="hero">
          <h1>Battery telemetry, live.</h1>
          <p>
            Four smart battery packs reporting over a simulated SMBus. Every value is decoded from raw Smart Battery
            Data Spec registers, stored in PostgreSQL, and served by a Flask API. One real second is one simulated minute.
          </p>
        </section>

        {status === "error" && (
          <div className="banner" role="alert">Can't reach the telemetry API. Retrying every {POLL_MS / 1000}s.</div>
        )}

        <div className="section-head">
          <h2>Fleet</h2>
          <span className="aside">Select a pack to inspect it</span>
        </div>
        <div className="fleet">
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
                <BatteryGlyph soc={latest?.soc_pct ?? 0} charging={!!latest?.charging} width={64} />
                <div>
                  <h2>
                    {selected.name} <span className="num" style={{ color: "var(--ink-3)", fontWeight: 600 }}>{latest?.soc_pct ?? "–"}%</span>
                  </h2>
                  <div className="detail-sub">
                    <span className="mono">{selected.serial}</span> · {selected.series_cells}S Li-ion ·{" "}
                    {selected.design_capacity_mah.toLocaleString()} mAh design
                  </div>
                </div>
              </div>
              <StatusPill {...packState(latest)} />
            </div>

            <StatRow reading={latest} />

            <div className="section-head">
              <h2>Last {HISTORY} readings</h2>
              <span className="aside">≈ {Math.round((HISTORY * POLL_MS * 60) / 3_600_000)} simulated hours · hover to compare</span>
            </div>
            <div className="charts" style={{ marginTop: 0 }}>
              <MetricChart
                title="State of charge" unit="%" data={charts.soc} format={(v) => v.toFixed(0)}
                domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} area baseline={0}
              />
              <MetricChart
                title="Voltage" unit="V" data={charts.voltage} format={(v) => v.toFixed(2)}
                domain={[floorTo(0.5, 0.1), ceilTo(0.5, 0.1)]}
              />
              <MetricChart
                title="Current · charging above zero" unit="A" data={charts.current} format={(v) => signed(v, 1)}
                domain={[(v) => Math.min(-1, floorTo(1)(v)), (v) => Math.max(1, ceilTo(1)(v))]} area baseline={0}
              />
              <MetricChart
                title="Temperature" unit="°C" data={charts.temp} format={(v) => v.toFixed(0)}
                domain={[20, (v) => Math.max(50, ceilTo(5)(v))]} ticks={[20, 30, 40, 50]}
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

        <div className="section-head">
          <h2>All packs</h2>
          <span className="aside">KendoReact Grid · sortable</span>
        </div>
        <div className="grid-wrap">
          <FleetTable fleet={fleet} selectedId={selectedId} onSelect={select} />
        </div>

        <footer className="footer">
          <span>Built by Ritika Joshi · Flask · SQLAlchemy · PostgreSQL · React · TypeScript · Zustand</span>
          <span>
            Simulated hardware, real protocol. <a href={REPO}>Source on GitHub</a>
          </span>
        </footer>
      </main>
    </>
  );
}
