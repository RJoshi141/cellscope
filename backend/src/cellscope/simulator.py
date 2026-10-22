import random

SMART_BATTERY_ADDR = 0x0B  # standard SBS slave address

# Smart Battery Data Spec command codes
SBS = {
    "temperature": 0x08,
    "voltage": 0x09,
    "current": 0x0A,
    "rsoc": 0x0D,
    "cycle_count": 0x17,
}


class FakeSMBus:
    """Same read_word_data() signature as smbus2.SMBus, so real hardware drops in."""

    def __init__(self, soc=100.0, cycles=0):
        self.soc, self.cycles = soc, cycles

    def read_word_data(self, addr, cmd):
        if cmd == SBS["rsoc"]:
            self.soc = max(0.0, self.soc - random.uniform(0, 0.5))  # slow drain
            return int(self.soc)
        if cmd == SBS["voltage"]:
            return int(3000 + 12 * self.soc + random.randint(-15, 15))  # mV, tracks charge
        if cmd == SBS["current"]:
            return (-random.randint(200, 1500)) & 0xFFFF  # signed 16-bit, negative = discharge
        if cmd == SBS["temperature"]:
            return int((random.uniform(25, 35) + 273.15) * 10)  # SBS reports 0.1 Kelvin
        if cmd == SBS["cycle_count"]:
            return self.cycles
        raise ValueError(f"unsupported command 0x{cmd:02X}")


def read_battery(bus, addr=SMART_BATTERY_ADDR):
    def word(name):
        return bus.read_word_data(addr, SBS[name])

    raw_i = word("current")
    return {
        "soc_pct": word("rsoc"),
        "voltage_mv": word("voltage"),
        "current_ma": raw_i - 0x10000 if raw_i & 0x8000 else raw_i,  # two's complement
        "temp_c": round(word("temperature") / 10 - 273.15, 1),
        "cycle_count": word("cycle_count"),
    }
