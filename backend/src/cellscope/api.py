from flask import Blueprint, abort, jsonify, request

from .extensions import db
from .models import Battery, Reading
from .simulator import PROFILES
from .telemetry import poll, poll_all

api_bp = Blueprint("api", __name__)


@api_bp.get("/health")
def health():
    db.session.execute(db.text("select 1"))
    return jsonify(ok=True)


@api_bp.get("/batteries")
def list_batteries():
    batteries = db.session.scalars(db.select(Battery).order_by(Battery.id))
    return jsonify([b.to_dict(b.latest_reading()) for b in batteries])


@api_bp.post("/batteries")
def create_battery():
    data = request.get_json(silent=True) or {}
    missing = {"serial", "name", "design_capacity_mah"} - data.keys()
    if missing:
        abort(400, f"missing: {', '.join(sorted(missing))}")
    if data.get("profile", "standard") not in PROFILES:
        abort(400, f"profile must be one of {', '.join(PROFILES)}")
    if db.session.scalar(db.select(Battery).filter_by(serial=data["serial"])):
        abort(409, "serial already registered")
    battery = Battery(
        serial=data["serial"],
        name=data["name"],
        design_capacity_mah=int(data["design_capacity_mah"]),
        series_cells=int(data.get("series_cells", 3)),
        profile=data.get("profile", "standard"),
        initial_cycles=int(data.get("cycle_count", 0)),
    )
    db.session.add(battery)
    db.session.commit()
    return jsonify(battery.to_dict()), 201


@api_bp.post("/poll")
def poll_fleet():
    return jsonify([b.to_dict(r) for b, r in poll_all()])


@api_bp.post("/batteries/<int:battery_id>/poll")
def poll_battery(battery_id):
    return jsonify(poll(db.get_or_404(Battery, battery_id)).to_dict()), 201


@api_bp.get("/batteries/<int:battery_id>/readings")
def readings(battery_id):
    db.get_or_404(Battery, battery_id)
    limit = max(1, min(request.args.get("limit", 90, type=int), 500))
    q = (
        db.select(Reading)
        .filter_by(battery_id=battery_id)
        .order_by(Reading.ts.desc())  # served by ix_reading_battery_ts
        .limit(limit)
    )
    rows = db.session.scalars(q).all()
    # raw register words only on the newest row, for the inspector
    return jsonify([r.to_dict(raw=(i == 0)) for i, r in enumerate(rows)])
