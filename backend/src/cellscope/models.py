from datetime import datetime, timezone

from sqlalchemy import JSON, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .extensions import db
from .simulator import DISCHARGING, OVER_TEMP_ALARM


def utcnow():
    # stored naive-UTC so SQLite and Postgres behave the same
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Battery(db.Model):
    id: Mapped[int] = mapped_column(primary_key=True)
    serial: Mapped[str] = mapped_column(unique=True)
    name: Mapped[str]
    design_capacity_mah: Mapped[int]
    series_cells: Mapped[int] = mapped_column(default=3)
    profile: Mapped[str] = mapped_column(default="standard")  # load profile for the simulator
    initial_cycles: Mapped[int] = mapped_column(default=0)

    # passive_deletes lets the DB cascade instead of SQLAlchemy loading every reading first
    readings: Mapped[list["Reading"]] = relationship(
        back_populates="battery", cascade="all, delete-orphan", passive_deletes=True
    )

    def latest_reading(self):
        return db.session.scalar(
            db.select(Reading)
            .filter_by(battery_id=self.id)
            .order_by(Reading.ts.desc())
            .limit(1)
        )

    def to_dict(self, latest=None):
        return {
            "id": self.id,
            "serial": self.serial,
            "name": self.name,
            "design_capacity_mah": self.design_capacity_mah,
            "series_cells": self.series_cells,
            "profile": self.profile,
            "latest": latest.to_dict() if latest else None,
        }


class Reading(db.Model):
    # composite index matches the hot query: one pack's readings, newest first
    __table_args__ = (Index("ix_reading_battery_ts", "battery_id", "ts"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    battery_id: Mapped[int] = mapped_column(ForeignKey("battery.id", ondelete="CASCADE"))
    ts: Mapped[datetime] = mapped_column(default=utcnow)
    voltage_mv: Mapped[int]
    current_ma: Mapped[int]
    temp_c: Mapped[float]
    soc_pct: Mapped[int]
    remaining_mah: Mapped[int]
    full_charge_mah: Mapped[int]
    cycle_count: Mapped[int]
    time_to_empty_min: Mapped[int | None]
    time_to_full_min: Mapped[int | None]
    status: Mapped[int]  # raw SBS BatteryStatus flags
    raw: Mapped[dict] = mapped_column(JSON, default=dict)  # register name -> 16-bit word as read
    battery: Mapped[Battery] = relationship(back_populates="readings")

    @property
    def charging(self):
        return not (self.status & DISCHARGING)

    def to_dict(self, raw=False):
        design = self.battery.design_capacity_mah
        return {
            "ts": self.ts.replace(tzinfo=timezone.utc).isoformat(),
            "voltage_mv": self.voltage_mv,
            "current_ma": self.current_ma,
            "power_w": round(self.voltage_mv * self.current_ma / 1e6, 2),
            "temp_c": self.temp_c,
            "soc_pct": self.soc_pct,
            "remaining_mah": self.remaining_mah,
            "full_charge_mah": self.full_charge_mah,
            "health_pct": round(100 * self.full_charge_mah / design, 1),
            "cycle_count": self.cycle_count,
            "time_to_empty_min": self.time_to_empty_min,
            "time_to_full_min": self.time_to_full_min,
            "charging": self.charging,
            "over_temp": bool(self.status & OVER_TEMP_ALARM),
            "status": self.status,
            **({"raw": self.raw} if raw else {}),
        }
