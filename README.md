# CellScope

**Live smart-battery telemetry.** A Flask + SQLAlchemy API reads battery packs over an SMBus interface, decodes raw Smart Battery Data Spec registers, stores the readings in PostgreSQL, and serves them over REST and JSON-RPC 2.0. A React + TypeScript dashboard polls it live.

**Live:** [cellscope-nine.vercel.app](https://cellscope-nine.vercel.app) · **Case study:** [rjoshi141.github.io/portfolio-v2](https://rjoshi141.github.io/portfolio-v2/#/work/cellscope)

The SMBus layer is simulated (`FakeSMBus`), but it uses the same `read_word_data(addr, cmd)` interface as `smbus2`, so real hardware can replace it without touching the API or the UI.

## Stack

| Layer | Tech |
| --- | --- |
| API | Python, Flask (app factory, blueprints), REST + JSON-RPC 2.0 (incl. batch + notifications) |
| Data | SQLAlchemy 2 typed models, PostgreSQL (Neon) in prod, SQLite locally, composite index on `(battery_id, ts)` |
| Hardware layer | Smart Battery Data Spec v1.1 registers, two's complement + 0.1 K decoding, Li-ion pack simulator |
| Frontend | React 19, TypeScript, Zustand, KendoReact Grid, Recharts, Vite |
| Tests / tooling | pytest, uv + hatchling, bash dev script |
| Hosting | Vercel (static frontend + Python serverless function) |

## Run locally

Needs [uv](https://docs.astral.sh/uv/) and Node 18+.

```bash
./scripts/dev.sh
```

Dashboard on http://localhost:5173 (Vite proxies `/api` to Flask on :5001). Two laptop and two phone batteries are seeded on first run.

```bash
cd backend && uv run pytest
```

## Architecture

```
Browser ──every 2s──▶ POST /api/poll ──▶ telemetry.poll_all()
                                          │  for each pack:
                                          │   last reading ─▶ PackState ─▶ step(dt) ─▶ FakeSMBus
                                          │   read_battery(bus): raw SBS words ─▶ decoded reading
                                          ▼
                                     PostgreSQL (Battery 1──* Reading)
```

**Stateless polling.** Serverless functions don't keep memory between requests, so the simulator never holds state. Each poll rebuilds the pack from its last stored reading, advances the physics by the elapsed time, and reads it through the bus. The database is the only source of truth.

**Throttled.** If a pack was polled less than 1.5 s ago, `poll` returns that reading instead of creating a new one, so ten open tabs still write one reading per tick. Gaps longer than 30 s are capped so an idle demo resumes instead of fast-forwarding days. Old readings are pruned opportunistically (no cron needed).

## The simulator

The demo fleet is two laptop packs (3 cells in series, ~11 V) and two phone batteries (single cell, ~3.7 V), each with a usage profile (light / standard / heavy):

- **Coulomb counting**: remaining capacity integrates current over time
- **Voltage** = cells × (open-circuit voltage from SoC curve + I × internal resistance), so it sags under load and rises while charging
- **CC-CV charging**: constant 0.5C current below 80%, tapering above, like a real charger
- **Heating**: I²R heating with a first-order lag toward the target temperature
- **Aging**: full charge capacity fades ~0.02% per cycle, so older packs report lower health
- **Time**: runs at 60× (one real second = one simulated minute) so full cycles are visible in a demo

## SMBus registers

Read from slave address `0x0B`, per the Smart Battery Data Specification v1.1:

| Register | Cmd | Raw unit | Decoded as |
| --- | --- | --- | --- |
| Temperature | `0x08` | 0.1 K | °C |
| Voltage | `0x09` | mV | V |
| Current | `0x0A` | signed 16-bit mA | two's complement, negative = discharging |
| RelativeStateOfCharge | `0x0D` | % | % |
| RemainingCapacity | `0x0F` | mAh | mAh |
| FullChargeCapacity | `0x10` | mAh | health = FCC / design |
| RunTimeToEmpty | `0x11` | min | `0xFFFF` = not discharging |
| AverageTimeToFull | `0x13` | min | `0xFFFF` = not charging |
| BatteryStatus | `0x16` | bit flags | `DISCHARGING`, `FULLY_CHARGED`, `OVER_TEMP_ALARM`, … |
| CycleCount | `0x17` | count | count |

### Connecting real hardware

Swap `FakeSMBus(state)` in `telemetry.py` for a real bus:

```python
from smbus2 import SMBus
bus = SMBus(1)  # /dev/i2c-1
reading = read_battery(bus)
```

With a Total Phase Aardvark or Promira adapter, wrap their Python API in a small class exposing `read_word_data(addr, cmd)`. Nothing else changes.

## API

### REST

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | DB connectivity check |
| GET | `/api/batteries` | Packs with their latest reading |
| POST | `/api/batteries` | Register a pack `{serial, name, design_capacity_mah, profile?, series_cells?, cycle_count?}` |
| POST | `/api/poll` | Poll the whole fleet (throttled) |
| POST | `/api/batteries/:id/poll` | Poll one pack |
| GET | `/api/batteries/:id/readings?limit=90` | History, newest first (max 500). Newest row includes raw register words |

Errors are JSON: `{"error": "Not Found", "message": "..."}`.

### JSON-RPC 2.0 · `POST /api/rpc`

```json
{"jsonrpc": "2.0", "id": 1, "method": "battery.poll", "params": {"battery_id": 1}}
```

Methods: `battery.list`, `battery.poll`, `fleet.poll`. Supports batch requests and notifications (no `id`, no response). Error codes: `-32700` parse error, `-32600` invalid request, `-32601` method not found, `-32602` invalid params.

## Deploy (Vercel + Neon)

1. Import the repo in Vercel. `vercel.json` handles the build: the frontend builds to `frontend/dist`, and `api/index.py` runs Flask as a Python function, with `/api/*` rewritten to it.
2. Add Neon Postgres from Vercel's Storage tab. It sets `DATABASE_URL`, which the app reads (and rewrites to the psycopg 3 driver).
3. Deploy. Tables are created and demo packs seeded on the first request.

The KendoReact Grid uses only free-tier features (single sort, single selection, column formats), so no license key is needed.

## Project layout

```
api/index.py              # Vercel entry: exposes the Flask app
backend/src/cellscope/
  __init__.py             # app factory, DB URL handling, JSON errors
  models.py               # Battery, Reading
  simulator.py            # SBS registers, pack physics, FakeSMBus, decoding
  telemetry.py            # stateless polling, throttling, pruning, seeding
  api.py                  # REST blueprint
  rpc.py                  # JSON-RPC 2.0 blueprint
backend/tests/
frontend/src/
  store.ts                # Zustand: polling loop, selection
  App.tsx
  components/             # PackCard, StatRow, MetricChart, RegisterInspector, FleetTable, …
scripts/dev.sh
vercel.json · requirements.txt
```
