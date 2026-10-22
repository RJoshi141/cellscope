import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { clock, simAgo } from "../format";

export type Point = { t: number; v: number; real: number }; // t: sim-scaled ms, real: wall clock
type Bound = number | ((edge: number) => number);

type Ref = { y: number; label: string; tone: "warning" | "critical" };

type Props = {
  title: string;
  unit: string;
  data: Point[];
  format: (v: number) => string;
  domain: [Bound, Bound];
  // area fill only where a zero baseline is meaningful (SoC, current); otherwise just the line
  area?: boolean;
  baseline?: number;
  refs?: Ref[];
  ticks?: number[];
};

const AXIS = { fontSize: 11, fill: "var(--ink-4)", fontFamily: "var(--font-mono)" };

function ChartTooltip({ active, payload, unit, format, now }: {
  active?: boolean; payload?: ReadonlyArray<{ payload: Point }>; unit: string; format: (v: number) => string; now: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tooltip">
      <div className="tooltip-time">{simAgo(p.t, now)} · {clock(p.real)}</div>
      <div className="tooltip-value">
        {format(p.v)}
        <small>{unit}</small>
      </div>
    </div>
  );
}

export function MetricChart({ title, unit, data, format, domain, area = false, baseline, refs = [], ticks }: Props) {
  const last = data[data.length - 1];
  const now = last?.t ?? 0;
  // ticks every simulated hour back from the newest reading (1 real minute = 1 sim hour)
  const first = data[0]?.t ?? 0;
  const xTicks = Array.from({ length: Math.floor((now - first) / 60_000) + 1 }, (_, i) => now - i * 60_000).reverse();
  const id = `fill-${title.replace(/\W/g, "")}`;
  return (
    <figure className="card chart-card" style={{ margin: 0 }} aria-label={`${title} over the last ${data.length} readings`}>
      <figcaption className="chart-head">
        <span className="chart-title">{title}</span>
        <span className="chart-value">
          {last ? format(last.v) : "–"}
          <small>{unit}</small>
        </span>
      </figcaption>
      {data.length < 2 ? (
        <div className="chart-empty">Collecting readings…</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} syncId="pack" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--series)" stopOpacity={0.16} />
                <stop offset="100%" stopColor="var(--series)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis
              dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]}
              ticks={xTicks} tickFormatter={(t: number) => (t === now ? "now" : `${Math.round((now - t) / 60_000)}h ago`)}
              tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--hairline-strong)" }} minTickGap={24}
            />
            <YAxis
              domain={domain} ticks={ticks} tick={AXIS} tickLine={false} axisLine={false}
              width={44} tickFormatter={(v: number) => format(v)} allowDecimals
            />
            {baseline !== undefined && <ReferenceLine y={baseline} stroke="var(--hairline-strong)" />}
            {refs.map((r) => (
              <ReferenceLine
                key={r.label} y={r.y} stroke={`var(--${r.tone}-fill)`} strokeOpacity={0.7} strokeDasharray="4 4"
                label={{ value: r.label, position: "insideTopLeft", fill: "var(--ink-3)", fontSize: 11 }}
              />
            ))}
            <Tooltip
              cursor={{ stroke: "var(--ink-4)", strokeWidth: 1 }}
              isAnimationActive={false}
              content={(p) => (
                <ChartTooltip
                  active={p.active}
                  payload={p.payload as unknown as ReadonlyArray<{ payload: Point }>}
                  unit={unit}
                  format={format}
                  now={now}
                />
              )}
            />
            <Area
              type="monotone" dataKey="v" stroke="var(--series)" strokeWidth={2}
              fill={area ? `url(#${id})` : "none"} baseValue={baseline ?? "dataMin"}
              isAnimationActive={false} strokeLinecap="round" strokeLinejoin="round"
              dot={false} activeDot={{ r: 4.5, strokeWidth: 2, stroke: "#fff", fill: "var(--series)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </figure>
  );
}
