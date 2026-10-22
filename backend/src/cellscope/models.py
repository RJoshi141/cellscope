from datetime import datetime, timezone

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .extensions import db


class Battery(db.Model):
    id: Mapped[int] = mapped_column(primary_key=True)
    serial: Mapped[str] = mapped_column(unique=True)
    name: Mapped[str]
    design_capacity_mah: Mapped[int]
    # one-to-many, newest first; cascade so deleting a battery cleans up readings
    readings: Mapped[list["Reading"]] = relationship(
        back_populates="battery",
        cascade="all, delete-orphan",
        order_by="Reading.ts.desc()",
    )

    def to_dict(self):
        latest = self.readings[0].to_dict() if self.readings else None
        return {
            "id": self.id,
            "serial": self.serial,
            "name": self.name,
            "design_capacity_mah": self.design_capacity_mah,
            "latest": latest,
        }


class Reading(db.Model):
    id: Mapped[int] = mapped_column(primary_key=True)
    battery_id: Mapped[int] = mapped_column(ForeignKey("battery.id"), index=True)
    ts: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc), index=True
    )
    voltage_mv: Mapped[int]
    current_ma: Mapped[int]
    temp_c: Mapped[float]
    soc_pct: Mapped[int]
    cycle_count: Mapped[int]
    battery: Mapped[Battery] = relationship(back_populates="readings")

    def to_dict(self):
        return {
            # SQLite drops tzinfo; values are stored as UTC, so tag them back
            "ts": self.ts.replace(tzinfo=timezone.utc).isoformat(),
            "voltage_mv": self.voltage_mv,
            "current_ma": self.current_ma,
            "temp_c": self.temp_c,
            "soc_pct": self.soc_pct,
            "cycle_count": self.cycle_count,
        }
