from flask import Blueprint, jsonify, request

from .api import poll
from .extensions import db
from .models import Battery

rpc_bp = Blueprint("rpc", __name__)


def _list(_params):
    return [b.to_dict() for b in db.session.scalars(db.select(Battery))]


def _poll(params):
    battery = db.session.get(Battery, params["battery_id"])
    if not battery:
        raise KeyError("battery not found")
    return poll(battery).to_dict()


METHODS = {"battery.list": _list, "battery.poll": _poll}


def err(id_, code, msg):
    return jsonify({"jsonrpc": "2.0", "id": id_, "error": {"code": code, "message": msg}})


@rpc_bp.post("/rpc")
def rpc():
    req = request.get_json(silent=True)
    if not isinstance(req, dict) or req.get("jsonrpc") != "2.0" or "method" not in req:
        return err(None, -32600, "Invalid Request")
    id_ = req.get("id")
    fn = METHODS.get(req["method"])
    if not fn:
        return err(id_, -32601, "Method not found")
    try:
        result = fn(req.get("params") or {})
    except (KeyError, TypeError) as e:
        return err(id_, -32602, f"Invalid params: {e}")
    return jsonify({"jsonrpc": "2.0", "id": id_, "result": result})
