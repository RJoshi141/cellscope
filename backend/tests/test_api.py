import pytest

from cellscope import create_app
from cellscope.simulator import FakeSMBus, read_battery


@pytest.fixture
def client():
    app = create_app({"SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:", "TESTING": True})
    return app.test_client()


def make_battery(client, serial="SN-001"):
    return client.post(
        "/api/batteries",
        json={"serial": serial, "name": "Pack A", "design_capacity_mah": 5000},
    ).get_json()


def test_read_battery_decodes_units():
    r = read_battery(FakeSMBus())
    assert r["current_ma"] < 0  # two's complement decoded
    assert 20 < r["temp_c"] < 40  # 0.1 K converted to C


def test_create_requires_fields(client):
    assert client.post("/api/batteries", json={"name": "x"}).status_code == 400


def test_poll_stores_reading(client):
    b = make_battery(client)
    r = client.post(f"/api/batteries/{b['id']}/poll").get_json()
    assert 0 <= r["soc_pct"] <= 100
    assert len(client.get(f"/api/batteries/{b['id']}/readings").get_json()) == 1


def test_unknown_battery_404(client):
    assert client.post("/api/batteries/999/poll").status_code == 404


def test_rpc_invalid_request(client):
    res = client.post("/rpc", json={"method": "battery.list"}).get_json()
    assert res["error"]["code"] == -32600


def test_rpc_method_not_found(client):
    res = client.post("/rpc", json={"jsonrpc": "2.0", "id": 1, "method": "nope"}).get_json()
    assert res["error"]["code"] == -32601


def test_rpc_poll(client):
    b = make_battery(client)
    res = client.post(
        "/rpc",
        json={"jsonrpc": "2.0", "id": 2, "method": "battery.poll", "params": {"battery_id": b["id"]}},
    ).get_json()
    assert res["id"] == 2
    assert "voltage_mv" in res["result"]


def test_rpc_bad_params(client):
    res = client.post(
        "/rpc", json={"jsonrpc": "2.0", "id": 3, "method": "battery.poll", "params": {}}
    ).get_json()
    assert res["error"]["code"] == -32602
