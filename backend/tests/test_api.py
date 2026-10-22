import random
from datetime import timedelta

import pytest

from cellscope import create_app, database_url
from cellscope.extensions import db
from cellscope.models import Battery, Reading
from cellscope.simulator import (
    DISCHARGING, FakeSMBus, initial_state, ocv_per_cell, read_battery, step,
)
from cellscope.telemetry import poll, utcnow


@pytest.fixture
def app():
    return create_app({"SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:", "TESTING": True, "SEED_DEMO": False})


@pytest.fixture
def client(app):
    return app.test_client()


def make_battery(client, serial="SN-001", **extra):
    body = {"serial": serial, "name": "Pack A", "design_capacity_mah": 5000, **extra}
    return client.post("/api/batteries", json=body)


def rpc(client, method, params=None, id_=1):
    body = {"jsonrpc": "2.0", "id": id_, "method": method}
    if params is not None:
        body["params"] = params
    return client.post("/api/rpc", json=body).get_json()


# --- simulator / decoding ---------------------------------------------------

def test_decodes_signed_current_and_kelvin():
    r = read_battery(FakeSMBus(initial_state(5000, 3, "standard", 0)))
    assert r["current_ma"] < 0  # two's complement decoded back to negative
    assert 20 < r["temp_c"] < 40  # 0.1 K -> C
    assert r["status"] & DISCHARGING
    assert r["time_to_full_min"] is None  # 0xFFFF sentinel -> None


def test_voltage_sags_under_load():
    s = initial_state(5000, 3, "heavy", 0)
    rest = 3 * ocv_per_cell(s.soc) * 1000
    assert read_battery(FakeSMBus(s))["voltage_mv"] < rest


def test_wrong_address_nacks():
    with pytest.raises(OSError):
        FakeSMBus(initial_state(5000, 3, "light", 0)).read_word_data(0x0C, 0x09)


def test_full_cycle_discharges_charges_and_counts():
    rng = random.Random(7)
    s = initial_state(5000, 3, "heavy", 10, rng)
    saw_charging = False
    for _ in range(5000):
        s = step(s, 2, rng)
        saw_charging |= s.charging
        if saw_charging and not s.charging:
            break
    assert saw_charging and s.cycles == 11 and s.soc > 99


def test_capacity_fades_with_cycles():
    fresh = read_battery(FakeSMBus(initial_state(5000, 3, "light", 0)))
    aged = read_battery(FakeSMBus(initial_state(5000, 3, "light", 1000)))
    assert fresh["full_charge_mah"] == 5000 and aged["full_charge_mah"] == 4000


# --- REST --------------------------------------------------------------------

def test_create_validates(client):
    assert client.post("/api/batteries", json={"name": "x"}).status_code == 400
    assert make_battery(client, profile="turbo").status_code == 400
    assert make_battery(client).status_code == 201
    assert make_battery(client).status_code == 409  # duplicate serial


def test_errors_are_json(client):
    res = client.post("/api/batteries/999/poll")
    assert res.status_code == 404 and res.get_json()["error"] == "Not Found"


def test_fleet_poll_and_history(client):
    b = make_battery(client).get_json()
    fleet = client.post("/api/poll").get_json()
    assert fleet[0]["latest"]["soc_pct"] > 0
    assert len(client.get(f"/api/batteries/{b['id']}/readings").get_json()) == 1


def test_poll_is_throttled_then_advances(app):
    with app.app_context():
        b = Battery(serial="T1", name="T", design_capacity_mah=5000)
        db.session.add(b)
        db.session.commit()
        t0 = utcnow()
        first = poll(b, t0)
        assert poll(b, t0 + timedelta(seconds=0.5)).id == first.id  # same reading
        later = poll(b, t0 + timedelta(seconds=10))
        assert later.id != first.id and later.remaining_mah < first.remaining_mah


def test_gap_is_capped(app):
    with app.app_context():
        b = Battery(serial="T2", name="T", design_capacity_mah=5000, profile="light")
        db.session.add(b)
        db.session.commit()
        t0 = utcnow()
        first = poll(b, t0)
        later = poll(b, t0 + timedelta(days=3))  # idle for days != drained to zero
        assert later.soc_pct >= first.soc_pct - 20


def test_seed_demo_is_idempotent():
    app = create_app({"SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        from cellscope.telemetry import seed_demo
        seed_demo()
        seed_demo()
        assert db.session.query(Battery).count() == 4


def test_seed_updates_existing_pack_config():
    app = create_app({"SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:", "SEED_DEMO": False})
    with app.app_context():
        from cellscope.telemetry import seed_demo
        db.session.add(Battery(serial="CS-24A-0001", name="Pack 01", design_capacity_mah=5100, series_cells=3))
        db.session.commit()
        poll(db.session.scalar(db.select(Battery)))  # a reading from the old 3-cell config
        seed_demo()
        assert db.session.query(Reading).count() == 0  # stale history cleared
        phone = db.session.scalar(db.select(Battery).filter_by(serial="CS-24A-0001"))
        assert (phone.name, phone.series_cells) == ("Phone 01", 1)
        assert [b["name"] for b in app.test_client().get("/api/batteries").get_json()][0].startswith("Laptop")


def test_database_url_rewrites_postgres(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgres://u:p@host/db?sslmode=require")
    assert database_url() == "postgresql+psycopg://u:p@host/db?sslmode=require"


# --- JSON-RPC ----------------------------------------------------------------

def test_rpc_errors(client):
    assert client.post("/api/rpc", data="{", content_type="application/json").get_json()["error"]["code"] == -32700
    assert client.post("/api/rpc", json={"method": "x"}).get_json()["error"]["code"] == -32600
    assert rpc(client, "nope")["error"]["code"] == -32601
    assert rpc(client, "battery.poll", {})["error"]["code"] == -32602


def test_rpc_poll_and_batch(client):
    b = make_battery(client).get_json()
    assert rpc(client, "battery.poll", {"battery_id": b["id"]}, id_=9)["result"]["voltage_mv"] > 0
    res = client.post("/api/rpc", json=[
        {"jsonrpc": "2.0", "id": 1, "method": "battery.list"},
        {"jsonrpc": "2.0", "method": "fleet.poll"},  # notification, no response
        {"jsonrpc": "2.0", "id": 2, "method": "nope"},
    ]).get_json()
    assert [r["id"] for r in res] == [1, 2] and "error" in res[1]


def test_raw_words_round_trip(client):
    b = make_battery(client).get_json()
    client.post("/api/poll")
    latest = client.get(f"/api/batteries/{b['id']}/readings").get_json()[0]
    raw = latest["raw"]
    assert raw["voltage"] == latest["voltage_mv"]
    assert raw["current"] == latest["current_ma"] & 0xFFFF  # wire format is unsigned
    assert raw["temperature"] == round((latest["temp_c"] + 273.15) * 10)


def test_database_url_on_vercel_without_db(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("VERCEL", "1")
    assert database_url() == "sqlite:////tmp/cellscope.db"
