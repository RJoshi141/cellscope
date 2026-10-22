"""JSON-RPC 2.0 endpoint at /api/rpc, alongside the REST routes."""

from flask import Blueprint, jsonify, request

from .extensions import db
from .models import Battery
from .telemetry import poll, poll_all

rpc_bp = Blueprint("rpc", __name__)


class InvalidParams(Exception):
    pass


def _battery(params):
    if not isinstance(params, dict) or "battery_id" not in params:
        raise InvalidParams("battery_id required")
    battery = db.session.get(Battery, params["battery_id"])
    if not battery:
        raise InvalidParams("battery not found")
    return battery


METHODS = {
    "battery.list": lambda p: [b.to_dict(b.latest_reading()) for b in db.session.scalars(db.select(Battery))],
    "battery.poll": lambda p: poll(_battery(p)).to_dict(),
    "fleet.poll": lambda p: [b.to_dict(r) for b, r in poll_all()],
}


def error(id_, code, message):
    return {"jsonrpc": "2.0", "id": id_, "error": {"code": code, "message": message}}


def handle(req):
    if not isinstance(req, dict) or req.get("jsonrpc") != "2.0" or not isinstance(req.get("method"), str):
        return error(None, -32600, "Invalid Request")
    id_ = req.get("id")
    fn = METHODS.get(req["method"])
    if not fn:
        return error(id_, -32601, "Method not found")
    try:
        result = fn(req.get("params", {}))
    except InvalidParams as e:
        return error(id_, -32602, f"Invalid params: {e}")
    if "id" not in req:
        return None  # notification: spec says no response
    return {"jsonrpc": "2.0", "id": id_, "result": result}


@rpc_bp.post("/rpc")
def rpc():
    body = request.get_json(silent=True)
    if body is None:
        return jsonify(error(None, -32700, "Parse error"))
    if isinstance(body, list):  # batch request
        if not body:
            return jsonify(error(None, -32600, "Invalid Request"))
        responses = [r for r in map(handle, body) if r is not None]
        return (jsonify(responses), 200) if responses else ("", 204)
    response = handle(body)
    return (jsonify(response), 200) if response else ("", 204)
