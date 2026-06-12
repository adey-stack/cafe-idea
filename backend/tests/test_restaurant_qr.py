"""Backend tests for Restaurant QR ordering systems."""
import os
import io
import json
import time
import uuid
import asyncio
import pytest
import requests
import websockets

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://restaurant-qr-order-2.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "owner@demo.com"
ADMIN_PASSWORD = "owner123"


@pytest.fixture(scope="session")
def session():
    return requests.Session()


@pytest.fixture(scope="session")
def restaurant(session):
    r = session.get(f"{BASE_URL}/api/restaurants/default", timeout=10)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="session")
def auth(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["token"], "user": data["user"], "headers": {"Authorization": f"Bearer {data['token']}"}}


# ---------- health/restaurant ----------
def test_default_restaurant(restaurant):
    assert restaurant["slug"] == "demo"
    assert "id" in restaurant
    assert restaurant["name"]


# ---------- auth ----------
def test_login_and_me(session, auth):
    assert auth["user"]["email"] == ADMIN_EMAIL
    assert auth["user"]["restaurant_id"]
    r = session.get(f"{BASE_URL}/api/auth/me", headers=auth["headers"], timeout=10)
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL


def test_login_invalid(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=10)
    assert r.status_code == 401


# ---------- menu ----------
def test_public_menu(session, restaurant):
    r = session.get(f"{BASE_URL}/api/menu/{restaurant['id']}", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert len(data["categories"]) == 4
    assert len(data["items"]) == 8


# ---------- tables ----------
def test_list_tables(session, auth):
    r = session.get(f"{BASE_URL}/api/tables", headers=auth["headers"], timeout=10)
    assert r.status_code == 200
    tables = r.json()
    assert len(tables) >= 6


def test_create_and_delete_table(session, auth):
    payload = {"table_number": f"TEST_{uuid.uuid4().hex[:6]}"}
    r = session.post(f"{BASE_URL}/api/tables", json=payload, headers=auth["headers"], timeout=10)
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["qr_code_url"].startswith("/uploads/qr/")
    # delete
    rd = session.delete(f"{BASE_URL}/api/tables/{t['id']}", headers=auth["headers"], timeout=10)
    assert rd.status_code == 200


# ---------- orders + websocket ----------
def test_orders_full_flow(session, auth, restaurant):
    # get a table
    tables = session.get(f"{BASE_URL}/api/tables/public?restaurant_id={restaurant['id']}", timeout=10).json()
    assert tables
    table = tables[0]
    # get items
    menu = session.get(f"{BASE_URL}/api/menu/{restaurant['id']}", timeout=10).json()
    item = menu["items"][0]
    # place order
    payload = {
        "restaurant_id": restaurant["id"],
        "table_id": table["id"],
        "items": [{"menu_item_id": item["id"], "name": item["name"], "price": item["price"], "quantity": 2}],
        "special_instructions": "TEST",
    }
    r = session.post(f"{BASE_URL}/api/orders", json=payload, timeout=10)
    assert r.status_code == 200, r.text
    order = r.json()
    assert order["status"] == "pending"
    assert order["total_amount"] == round(item["price"] * 2, 2)
    oid = order["id"]
    # list
    r = session.get(f"{BASE_URL}/api/orders", headers=auth["headers"], timeout=10)
    assert r.status_code == 200
    assert any(o["id"] == oid for o in r.json())
    # advance
    for s in ["confirmed", "preparing", "ready", "served"]:
        rs = session.patch(f"{BASE_URL}/api/orders/{oid}/status", json={"status": s}, headers=auth["headers"], timeout=10)
        assert rs.status_code == 200
        assert rs.json()["status"] == s


# ---------- dashboard ----------
def test_dashboard_stats(session, auth):
    r = session.get(f"{BASE_URL}/api/dashboard/stats", headers=auth["headers"], timeout=10)
    assert r.status_code == 200
    d = r.json()
    for key in ["today_revenue", "today_orders", "pending_orders", "popular_items", "hourly"]:
        assert key in d
    assert len(d["hourly"]) == 24


# ---------- menu CRUD ----------
def test_menu_crud(session, auth):
    # create category
    r = session.post(f"{BASE_URL}/api/menu/category", json={"name": "TEST_Cat", "sort_order": 99}, headers=auth["headers"], timeout=10)
    assert r.status_code == 200
    cat = r.json()
    # update
    ru = session.put(f"{BASE_URL}/api/menu/category/{cat['id']}", json={"name": "TEST_Cat2", "sort_order": 100}, headers=auth["headers"], timeout=10)
    assert ru.status_code == 200
    # add item
    ri = session.post(f"{BASE_URL}/api/menu/item", json={"name": "TEST_Item", "price": 99.0, "category_id": cat["id"]}, headers=auth["headers"], timeout=10)
    assert ri.status_code == 200
    item = ri.json()
    # toggle
    rt = session.patch(f"{BASE_URL}/api/menu/item/{item['id']}/toggle", headers=auth["headers"], timeout=10)
    assert rt.status_code == 200
    assert rt.json()["is_available"] is False
    # update item
    rpu = session.put(f"{BASE_URL}/api/menu/item/{item['id']}", json={"price": 101.0}, headers=auth["headers"], timeout=10)
    assert rpu.status_code == 200
    assert rpu.json()["price"] == 101.0
    # delete item
    session.delete(f"{BASE_URL}/api/menu/item/{item['id']}", headers=auth["headers"], timeout=10)
    # delete category
    rd = session.delete(f"{BASE_URL}/api/menu/category/{cat['id']}", headers=auth["headers"], timeout=10)
    assert rd.status_code == 200


# ---------- upload ----------
def test_upload_image(session, auth):
    # 1x1 PNG
    png = bytes.fromhex("89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6300010000000500010D0A2DB40000000049454E44AE426082")
    files = {"file": ("test.png", png, "image/png")}
    r = session.post(f"{BASE_URL}/api/upload/menu-image", files=files, headers={"Authorization": auth["headers"]["Authorization"]}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["url"].startswith("/uploads/menu/")


# ---------- websocket ----------
@pytest.mark.asyncio
async def test_websocket_new_order(restaurant):
    ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + f"/ws/{restaurant['id']}"
    async with websockets.connect(ws_url) as ws:
        # place order in background
        sess = requests.Session()
        tables = sess.get(f"{BASE_URL}/api/tables/public?restaurant_id={restaurant['id']}", timeout=10).json()
        menu = sess.get(f"{BASE_URL}/api/menu/{restaurant['id']}", timeout=10).json()
        item = menu["items"][0]
        payload = {
            "restaurant_id": restaurant["id"],
            "table_id": tables[0]["id"],
            "items": [{"menu_item_id": item["id"], "name": item["name"], "price": item["price"], "quantity": 1}],
        }
        # small delay so connect is registered
        await asyncio.sleep(0.5)
        sess.post(f"{BASE_URL}/api/orders", json=payload, timeout=10)
        msg = await asyncio.wait_for(ws.recv(), timeout=10)
        data = json.loads(msg)
        assert data["type"] == "new_order"
