import { useMemo, useState } from "react";
import { orderBy, type SortDescriptor } from "@progress/kendo-data-query";
import {
  Grid, GridColumn, type GridRowClickEvent, type GridSelectionChangeEvent, type GridSortChangeEvent,
} from "@progress/kendo-react-grid";
import { packState } from "../format";
import type { Battery } from "../types";

// Sticks to KendoReact's free tier (single sort, single selection, column formats).
// Custom cell/row templates are premium and would need a license key.
export function FleetTable({ fleet, selectedId, onSelect }: {
  fleet: Battery[]; selectedId: number | null; onSelect: (id: number) => void;
}) {
  const [sort, setSort] = useState<SortDescriptor[]>([]);
  const rows = useMemo(
    () =>
      orderBy(
        fleet.map((b) => ({
          id: b.id,
          name: b.name,
          serial: b.serial,
          state: packState(b.latest).label,
          soc: b.latest?.soc_pct ?? 0,
          voltage: (b.latest?.voltage_mv ?? 0) / 1000,
          current: (b.latest?.current_ma ?? 0) / 1000,
          power: b.latest?.power_w ?? 0,
          temp: b.latest?.temp_c ?? 0,
          health: b.latest?.health_pct ?? 0,
          cycles: b.latest?.cycle_count ?? 0,
        })),
        sort,
      ),
    [fleet, sort],
  );

  return (
    <Grid
      className="fleet-grid"
      data={rows}
      dataItemKey="id"
      sortable
      sort={sort}
      onSortChange={(e: GridSortChangeEvent) => setSort(e.sort)}
      selectable={{ enabled: true, mode: "single" }}
      select={selectedId ? { [selectedId]: true } : {}}
      onSelectionChange={(e: GridSelectionChangeEvent) => {
        const id = Number(Object.keys(e.select).find((k) => e.select[k]));
        if (id) onSelect(id);
      }}
      onRowClick={(e: GridRowClickEvent) => onSelect((e.dataItem as { id: number }).id)}
    >
      <GridColumn field="name" title="Pack" width={120} />
      <GridColumn field="state" title="State" width={140} />
      <GridColumn field="soc" title="Charge (%)" format="{0:n0}" />
      <GridColumn field="voltage" title="Voltage (V)" format="{0:n2}" />
      <GridColumn field="current" title="Current (A)" format="{0:n2}" />
      <GridColumn field="power" title="Power (W)" format="{0:n1}" />
      <GridColumn field="temp" title="Temp (°C)" format="{0:n1}" />
      <GridColumn field="health" title="Health (%)" format="{0:n1}" />
      <GridColumn field="cycles" title="Cycles" format="{0:n0}" />
    </Grid>
  );
}
