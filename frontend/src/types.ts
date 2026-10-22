export type RegisterName =
  | "temperature" | "voltage" | "current" | "rsoc" | "remaining_capacity"
  | "full_charge_capacity" | "run_time_to_empty" | "average_time_to_full"
  | "battery_status" | "cycle_count" | "design_capacity";

export type Reading = {
  ts: string;
  voltage_mv: number;
  current_ma: number; // negative = discharging
  power_w: number;
  temp_c: number;
  soc_pct: number;
  remaining_mah: number;
  full_charge_mah: number;
  health_pct: number;
  cycle_count: number;
  time_to_empty_min: number | null;
  time_to_full_min: number | null;
  charging: boolean;
  over_temp: boolean;
  status: number;
  raw?: Record<RegisterName, number>; // newest reading only
};

export type Battery = {
  id: number;
  serial: string;
  name: string;
  design_capacity_mah: number;
  series_cells: number;
  profile: "light" | "standard" | "heavy";
  latest: Reading | null;
};
