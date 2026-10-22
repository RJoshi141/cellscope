"""Simulated smart battery pack behind an SMBus interface.

The physics lives in step(). FakeSMBus only encodes a PackState into raw SBS
register words, exactly like a real gas-gauge chip would. read_battery() decodes
those words. Swap FakeSMBus for smbus2.SMBus and read_battery() works unchanged.
"""

import random
from dataclasses import dataclass, replace

SMART_BATTERY_ADDR = 0x0B  # standard SBS slave address
SIM_SPEED = 60  # 1 real second = 1 simulated minute, so cycles are visible in a demo

# Smart Battery Data Specification v1.1 command codes
SBS = {
    "temperature": 0x08,  # 0.1 K
    "voltage": 0x09,  # mV
    "current": 0x0A,  # mA, signed 16-bit
    "rsoc": 0x0D,  # RelativeStateOfCharge, %
    "remaining_capacity": 0x0F,  # mAh
    "full_charge_capacity": 0x10,  # mAh
    "run_time_to_empty": 0x11,  # minutes, 0xFFFF = not discharging
    "average_time_to_full": 0x13,  # minutes, 0xFFFF = not charging
    "battery_status": 0x16,  # bit flags below
    "cycle_count": 0x17,
    "design_capacity": 0x18,  # mAh
}

# BatteryStatus bits
OVER_TEMP_ALARM = 0x1000
INITIALIZED = 0x0080
DISCHARGING = 0x0040
FULLY_CHARGED = 0x0020
FULLY_DISCHARGED = 0x0010

NO_TIME = 0xFFFF

# Typical Li-ion open-circuit voltage per cell vs state of charge
OCV_CURVE = [
    (0, 3.00), (5, 3.45), (10, 3.60), (20, 3.69), (40, 3.78),
    (60, 3.87), (80, 4.00), (90, 4.08), (100, 4.20),
]
CELL_RESISTANCE_OHM = 0.05
AMBIENT_C = 24.0
OVER_TEMP_C = 45.0

# discharge load range in mA per usage profile
PROFILES = {
    "light": (400, 1100),
    "standard": (900, 2000),
    "heavy": (2000, 3400),
}

CHARGE_START_PCT = 12  # start charging when this low
CC_CV_KNEE_PCT = 80  # constant current below, tapering constant voltage above


def ocv_per_cell(soc):
    """Linear interpolation over the OCV table."""
    soc = max(0.0, min(100.0, soc))
    for (s0, v0), (s1, v1) in zip(OCV_CURVE, OCV_CURVE[1:]):
        if soc <= s1:
            return v0 + (v1 - v0) * (soc - s0) / (s1 - s0)
    return OCV_CURVE[-1][1]


def full_charge_capacity(design_mah, cycles):
    """Rough linear fade: ~80% health around 1000 cycles, floored at 60%."""
    return design_mah * max(0.6, 1 - 0.0002 * cycles)


@dataclass
class PackState:
    design_mah: int
    cells: int
    profile: str
    remaining_mah: float
    current_ma: float  # negative = discharging
    temp_c: float
    cycles: int
    charging: bool

    @property
    def full_mah(self):
        return full_charge_capacity(self.design_mah, self.cycles)

    @property
    def soc(self):
        return 100 * self.remaining_mah / self.full_mah


def initial_state(design_mah, cells, profile, cycles, rng=random):
    lo, hi = PROFILES[profile]
    return PackState(
        design_mah=design_mah,
        cells=cells,
        profile=profile,
        remaining_mah=full_charge_capacity(design_mah, cycles) * rng.uniform(0.55, 0.95),
        current_ma=-(lo + hi) / 2,
        temp_c=AMBIENT_C + 4,
        cycles=cycles,
        charging=False,
    )


def step(state: PackState, dt_real_s: float, rng=random) -> PackState:
    """Advance the pack by dt_real_s real seconds (scaled by SIM_SPEED)."""
    dt = dt_real_s * SIM_SPEED
    s = replace(state)
    charge_rate = 0.5 * s.design_mah  # 0.5C charger

    if s.charging:
        if s.soc < CC_CV_KNEE_PCT:
            target = charge_rate
        else:  # CV phase: current tapers as the pack fills
            target = max(60.0, charge_rate * (100 - s.soc) / (100 - CC_CV_KNEE_PCT))
        s.current_ma = target * rng.uniform(0.98, 1.02)
    else:
        lo, hi = PROFILES[s.profile]
        # smooth toward a random load so the trace looks like real usage, not noise
        target = -rng.uniform(lo, hi)
        s.current_ma = 0.75 * s.current_ma + 0.25 * target

    # coulomb counting
    s.remaining_mah = max(0.0, min(s.full_mah, s.remaining_mah + s.current_ma * dt / 3600))

    # I^2 heating with a first-order lag toward the target temperature
    amps = abs(s.current_ma) / 1000
    target_temp = AMBIENT_C + 1.3 * amps**2 + (1.5 if s.charging else 0)
    s.temp_c += (target_temp - s.temp_c) * min(1.0, dt / 600) + rng.uniform(-0.05, 0.05)

    # mode transitions
    if s.charging and s.soc >= 99.5:
        s.charging = False
        s.cycles += 1  # one charge cycle completed (approximation of cumulative-discharge counting)
        s.remaining_mah = s.full_mah  # fade can shrink capacity under us
    elif not s.charging and s.soc <= CHARGE_START_PCT:
        s.charging = True

    return s


class FakeSMBus:
    """Same read_word_data(addr, cmd) signature as smbus2.SMBus."""

    def __init__(self, state: PackState):
        self.state = state

    def read_word_data(self, addr, cmd):
        if addr != SMART_BATTERY_ADDR:
            raise OSError(f"no device at 0x{addr:02X}")  # what a real bus does on NACK
        s = self.state
        if cmd == SBS["temperature"]:
            return round((s.temp_c + 273.15) * 10)
        if cmd == SBS["voltage"]:
            volts = s.cells * (ocv_per_cell(s.soc) + (s.current_ma / 1000) * CELL_RESISTANCE_OHM)
            return round(volts * 1000)
        if cmd == SBS["current"]:
            return round(s.current_ma) & 0xFFFF
        if cmd == SBS["rsoc"]:
            return round(s.soc)
        if cmd == SBS["remaining_capacity"]:
            return round(s.remaining_mah)
        if cmd == SBS["full_charge_capacity"]:
            return round(s.full_mah)
        if cmd == SBS["design_capacity"]:
            return s.design_mah
        if cmd == SBS["cycle_count"]:
            return s.cycles
        if cmd == SBS["run_time_to_empty"]:
            if s.charging or s.current_ma >= 0:
                return NO_TIME
            return min(NO_TIME - 1, round(s.remaining_mah / -s.current_ma * 60))
        if cmd == SBS["average_time_to_full"]:
            if not s.charging or s.current_ma <= 0:
                return NO_TIME
            return min(NO_TIME - 1, round((s.full_mah - s.remaining_mah) / s.current_ma * 60))
        if cmd == SBS["battery_status"]:
            flags = INITIALIZED
            if not s.charging:
                flags |= DISCHARGING
            if s.soc >= 99.5:
                flags |= FULLY_CHARGED
            if s.remaining_mah <= 0:
                flags |= FULLY_DISCHARGED
            if s.temp_c >= OVER_TEMP_C:
                flags |= OVER_TEMP_ALARM
            return flags
        raise ValueError(f"unsupported command 0x{cmd:02X}")


def _signed16(word):
    return word - 0x10000 if word & 0x8000 else word  # two's complement


def _minutes(word):
    return None if word == NO_TIME else word


def read_battery(bus, addr=SMART_BATTERY_ADDR):
    """Read and decode one snapshot from any SMBus-like object."""

    raw = {}

    def word(name):
        raw[name] = bus.read_word_data(addr, SBS[name])  # keep the wire value for the inspector
        return raw[name]

    status = word("battery_status")
    decoded = {
        "voltage_mv": word("voltage"),
        "current_ma": _signed16(word("current")),
        "temp_c": round(word("temperature") / 10 - 273.15, 1),
        "soc_pct": word("rsoc"),
        "remaining_mah": word("remaining_capacity"),
        "full_charge_mah": word("full_charge_capacity"),
        "cycle_count": word("cycle_count"),
        "time_to_empty_min": _minutes(word("run_time_to_empty")),
        "time_to_full_min": _minutes(word("average_time_to_full")),
        "status": status,
    }
    return {**decoded, "raw": raw}
