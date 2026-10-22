export type Reading = {
  ts: string;
  voltage_mv: number;
  current_ma: number;
  temp_c: number;
  soc_pct: number;
  cycle_count: number;
};

export type Battery = {
  id: number;
  serial: string;
  name: string;
  design_capacity_mah: number;
  latest: Reading | null;
};
