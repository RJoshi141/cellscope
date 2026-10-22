"""Polling service: rebuilds pack state from the last stored reading, so it is
stateless between requests (works on serverless, where memory does not persist)."""

import random
from datetime import timedelta

from .extensions import db
from .models import Battery, Reading, utcnow
from .simulator import FakeSMBus, PackState, initial_state, read_battery, step

MIN_INTERVAL = timedelta(seconds=1.5)  # many viewers polling still means one reading per tick
MAX_GAP = timedelta(seconds=30)  # after idle time, resume instead of fast-forwarding hours
RETENTION = timedelta(hours=2)


def state_from(battery: Battery, last: Reading | None) -> PackState:
    if last is None:
        return initial_state(
            battery.design_capacity_mah, battery.series_cells, battery.profile, battery.initial_cycles
        )
    return PackState(
        design_mah=battery.design_capacity_mah,
        cells=battery.series_cells,
        profile=battery.profile,
        remaining_mah=last.remaining_mah,
        current_ma=last.current_ma,
        temp_c=last.temp_c,
        cycles=last.cycle_count,
        charging=last.charging,
    )


def poll(battery: Battery, now=None) -> Reading:
    now = now or utcnow()
    last = battery.latest_reading()
    if last and now - last.ts < MIN_INTERVAL:
        return last  # throttled: someone else just polled this pack

    state = state_from(battery, last)
    if last:
        state = step(state, min(now - last.ts, MAX_GAP).total_seconds())

    bus = FakeSMBus(state)  # swap for smbus2.SMBus(1) on real hardware
    reading = Reading(battery=battery, ts=now, **read_battery(bus))
    db.session.add(reading)
    db.session.commit()
    return reading


def poll_all():
    batteries = db.session.scalars(db.select(Battery).order_by(Battery.id)).all()
    results = [(b, poll(b)) for b in batteries]
    if random.random() < 0.02:  # cheap periodic cleanup, no cron needed
        prune()
    return results


def prune():
    cutoff = utcnow() - RETENTION
    db.session.execute(db.delete(Reading).where(Reading.ts < cutoff))
    db.session.commit()


DEMO_PACKS = [
    # serial, name, design mAh, profile, starting cycles
    ("CS-24A-0001", "Pack 01", 5100, "light", 18),
    ("CS-24A-0002", "Pack 02", 5100, "standard", 236),
    ("CS-24B-0003", "Pack 03", 4800, "heavy", 512),
    ("CS-23C-0004", "Pack 04", 4800, "standard", 947),
]


def seed_demo():
    if db.session.scalar(db.select(Battery).limit(1)):
        return
    for serial, name, mah, profile, cycles in DEMO_PACKS:
        db.session.add(
            Battery(serial=serial, name=name, design_capacity_mah=mah, profile=profile, initial_cycles=cycles)
        )
    try:
        db.session.commit()
    except Exception:  # two cold starts seeding at once; the unique serial makes one lose
        db.session.rollback()
