import { useMemo, useState } from "react";
import { orderBy, type SortDescriptor } from "@progress/kendo-data-query";
import {
  Grid, GridColumn, type GridPageChangeEvent, type GridSortChangeEvent,
} from "@progress/kendo-react-grid";
import { hex16 } from "../format";
import type { Reading } from "../types";

const PAGE = 10;

// KendoReact Grid, free tier only: sorting, numeric pager, column formats
export function ReadingLog({ history }: { history: Reading[] }) {
  const [sort, setSort] = useState<SortDescriptor[]>([{ field: "t", dir: "desc" }]);
  const [skip, setSkip] = useState(0);

  const rows = useMemo(
    () =>
      orderBy(
        history.map((r) => {
          const t = Date.parse(r.ts);
          return {
            t,
            time: new Date(t).toLocaleTimeString([], { hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            mode: r.charging ? "Charging" : "Discharging",
            soc: r.soc_pct,
            voltage: r.voltage_mv / 1000,
            current: r.current_ma / 1000,
            power: r.power_w,
            temp: r.temp_c,
            remaining: r.remaining_mah,
            flags: hex16(r.status),
          };
        }),
        sort,
      ),
    [history, sort],
  );

  return (
    <Grid
      className="log-grid"
      data={rows.slice(skip, skip + PAGE)}
      total={rows.length}
      skip={skip}
      take={PAGE}
      pageable={{ buttonCount: 5, info: true, type: "numeric", pageSizes: false, previousNext: true }}
      onPageChange={(e: GridPageChangeEvent) => setSkip(e.page.skip)}
      sortable
      sort={sort}
      onSortChange={(e: GridSortChangeEvent) => {
        setSort(e.sort);
        setSkip(0);
      }}
    >
      <GridColumn field="time" title="Time" className="mono" />
      <GridColumn field="mode" title="Mode" />
      <GridColumn field="soc" title="SoC (%)" format="{0:n0}" className="mono num-col" headerClassName="num-col" />
      <GridColumn field="voltage" title="Voltage (V)" format="{0:n3}" className="mono num-col" headerClassName="num-col" />
      <GridColumn field="current" title="Current (A)" format="{0:n3}" className="mono num-col" headerClassName="num-col" />
      <GridColumn field="power" title="Power (W)" format="{0:n2}" className="mono num-col" headerClassName="num-col" />
      <GridColumn field="temp" title="Temp (°C)" format="{0:n1}" className="mono num-col" headerClassName="num-col" />
      <GridColumn field="remaining" title="Remaining (mAh)" format="{0:n0}" className="mono num-col" headerClassName="num-col" />
      <GridColumn field="flags" title="Status" className="mono num-col" headerClassName="num-col" />
    </Grid>
  );
}
