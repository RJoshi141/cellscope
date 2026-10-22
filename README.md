# CellScope

Battery health monitor. A Flask + SQLAlchemy API reads Smart Battery telemetry over an SMBus interface, stores it as time-series data, and serves it over REST and JSON-RPC 2.0. A React + TypeScript dashboard polls it live.

The SMBus layer is simulated (`FakeSMBus`), but it uses the same `read_word_data(addr, cmd)` interface as `smbus2`, so real hardware can replace it without touching the API or the UI.

## Stack

- **Backend:** Python, Flask (app factory, blueprints), Flask-SQLAlchemy 3 (typed ORM models, one-to-many relationships), pytest
- **Packaging:** uv + hatchling
- **Frontend:** React 19, TypeScript, Zustand, KendoReact Grid, Recharts, Vite
- **Tooling:** bash dev script (starts API, waits for health, seeds data, starts UI)

## Run it

Needs [uv](https://docs.astral.sh/uv/) and Node 18+.

```bash
./scripts/dev.sh
```

API on `http://localhost:5001`, dashboard on `http://localhost:5173`.

Tests:

```bash
cd backend && uv run pytest
```

## API

### REST

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/batteries` | List packs with their latest reading |
| POST | `/api/batteries` | Register a pack `{serial, name, design_capacity_mah}` |
| POST | `/api/batteries/:id/poll` | Read the pack over SMBus and store a reading |
| GET | `/api/batteries/:id/readings?limit=50` | Reading history, newest first (max 500) |

### JSON-RPC 2.0

`POST /rpc`

```json
{"jsonrpc": "2.0", "id": 1, "method": "battery.poll", "params": {"battery_id": 1}}
```

Methods: `battery.list`, `battery.poll`. Standard error codes: `-32600` invalid request, `-32601` method not found, `-32602` invalid params.

## How the SMBus layer works

Smart batteries expose data on standard [Smart Battery Data Specification](http://sbs-forum.org/specs/) command codes at slave address `0x0B`:

| Register | Code | Raw unit | Decoded |
| --- | --- | --- | --- |
| Temperature | `0x08` | 0.1 K | °C |
| Voltage | `0x09` | mV | mV |
| Current | `0x0A` | signed 16-bit mA | two's complement → mA (negative = discharging) |
| RelativeStateOfCharge | `0x0D` | % | % |
| CycleCount | `0x17` | count | count |

`read_battery()` in `simulator.py` does the decoding. `FakeSMBus` produces plausible values (draining charge, voltage tracking charge, noisy temperature).

### Connecting real hardware

Swap `FakeSMBus()` in `api.py` for a real bus. With a Linux I2C adapter:

```python
from smbus2 import SMBus
bus = SMBus(1)  # /dev/i2c-1
```

With a Total Phase Aardvark or Promira, wrap their Python API in a small class exposing `read_word_data(addr, cmd)`. Nothing else changes.

## Project layout

```
backend/
  src/cellscope/
    __init__.py    # app factory
    extensions.py  # SQLAlchemy instance
    models.py      # Battery, Reading
    simulator.py   # SBS registers, FakeSMBus, decoding
    api.py         # REST blueprint
    rpc.py         # JSON-RPC 2.0 blueprint
  tests/
frontend/
  src/
    store.ts       # Zustand store, polling
    App.tsx        # Kendo grid + history chart
scripts/dev.sh
```

## Next

- SMBus PEC (packet error checking) validation
- State-of-health from FullChargeCapacity vs DesignCapacity
- Alert thresholds per pack
