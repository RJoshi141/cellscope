import { useEffect, useMemo } from "react";
import { Grid, GridColumn, type GridRowClickEvent } from "@progress/kendo-react-grid";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { isHot, useBatteries } from "./store";

const POLL_MS = 2000;

export default function App() {
  const { batteries, readings, selectedId, error, select, tick } = useBatteries();

  useEffect(() => {
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => clearInterval(t);
  }, [tick]);

  // flatten for the grid: Kendo binds columns to top-level fields
  const rows = useMemo(
    () =>
      batteries.map((b) => ({
        id: b.id,
        name: b.name,
        serial: b.serial,
        soc: b.latest ? `${b.latest.soc_pct}%` : "–",
        voltage: b.latest ? `${(b.latest.voltage_mv / 1000).toFixed(2)} V` : "–",
        current: b.latest ? `${b.latest.current_ma} mA` : "–",
        temp: b.latest ? `${b.latest.temp_c} °C${isHot(b.latest) ? " ⚠" : ""}` : "–",
        cycles: b.latest?.cycle_count ?? 0,
      })),
    [batteries],
  );

  // API returns newest first; chart wants oldest → newest
  const history = useMemo(
    () =>
      [...(selectedId ? readings[selectedId] ?? [] : [])].reverse().map((r) => ({
        time: new Date(r.ts).toLocaleTimeString(),
        soc: r.soc_pct,
        voltage: r.voltage_mv / 1000,
      })),
    [readings, selectedId],
  );

  const selected = batteries.find((b) => b.id === selectedId);

  return (
    <main className="page">
      <header>
        <h1>CellScope</h1>
        <p className="sub">Smart battery telemetry over a simulated SMBus · polling every {POLL_MS / 1000}s</p>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="card">
        <h2>Packs</h2>
        <Grid
          data={rows}
          onRowClick={(e: GridRowClickEvent) => select(e.dataItem.id)}
          style={{ cursor: "pointer" }}
        >
          <GridColumn field="name" title="Pack" />
          <GridColumn field="serial" title="Serial" />
          <GridColumn field="soc" title="SoC" />
          <GridColumn field="voltage" title="Voltage" />
          <GridColumn field="current" title="Current" />
          <GridColumn field="temp" title="Temp" />
          <GridColumn field="cycles" title="Cycles" />
        </Grid>
      </section>

      <section className="card">
        <h2>{selected ? `${selected.name} history` : "History"}</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" minTickGap={40} />
            <YAxis yAxisId="soc" domain={[0, 100]} unit="%" />
            <YAxis yAxisId="v" orientation="right" domain={["auto", "auto"]} unit="V" />
            <Tooltip />
            <Line yAxisId="soc" dataKey="soc" name="SoC" stroke="#2f6fed" dot={false} isAnimationActive={false} />
            <Line yAxisId="v" dataKey="voltage" name="Voltage" stroke="#e8743b" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>
    </main>
  );
}
