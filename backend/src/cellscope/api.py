from flask import Blueprint, abort, jsonify, request

from .extensions import db
from .models import Battery, Reading
from .simulator import FakeSMBus, read_battery

api_bp = Blueprint("api", __name__)
_buses: dict[int, FakeSMBus] = {}  # one fake bus per battery, in memory

REQUIRED = ("serial", "name", "design_capacity_mah")


def poll(battery: Battery) -> Reading:
    bus = _buses.setdefault(battery.id, FakeSMBus())
    reading = Reading(battery=battery, **read_battery(bus))
    db.session.add(reading)
    db.session.commit()
    return reading


@api_bp.get("/batteries")
def list_batteries():
    return jsonify([b.to_dict() for b in db.session.scalars(db.select(Battery))])


@api_bp.post("/batteries")
def create_battery():
    data = request.get_json(silent=True) or {}
    if not set(REQUIRED) <= data.keys():
        abort(400, "serial, name, design_capacity_mah required")
    battery = Battery(**{k: data[k] for k in REQUIRED})
    db.session.add(battery)
    db.session.commit()
    return jsonify(battery.to_dict()), 201


@api_bp.post("/batteries/<int:battery_id>/poll")
def poll_battery(battery_id):
    return jsonify(poll(db.get_or_404(Battery, battery_id)).to_dict()), 201


@api_bp.get("/batteries/<int:battery_id>/readings")
def readings(battery_id):
    db.get_or_404(Battery, battery_id)
    limit = min(request.args.get("limit", 50, type=int), 500)
    q = (
        db.select(Reading)
        .filter_by(battery_id=battery_id)
        .order_by(Reading.ts.desc())  # indexed on battery_id + ts
        .limit(limit)
    )
    return jsonify([r.to_dict() for r in db.session.scalars(q)])
