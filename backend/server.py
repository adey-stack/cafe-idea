from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
import uuid
import json
import base64
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict

import bcrypt
import jwt
import qrcode
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------- Setup ----------
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / "qr").mkdir(exist_ok=True)
(UPLOAD_DIR / "menu").mkdir(exist_ok=True)

app = FastAPI(title="Restaurant QR Ordering API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Helpers ----------
def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------- Models ----------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class CategoryIn(BaseModel):
    name: str
    sort_order: int = 0
    restaurant_id: Optional[str] = None


class MenuItemIn(BaseModel):
    name: str
    description: str = ""
    price: float
    image_url: str = ""
    category_id: str
    is_veg: bool = True
    is_available: bool = True
    restaurant_id: Optional[str] = None


class MenuItemPatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image_url: Optional[str] = None
    category_id: Optional[str] = None
    is_veg: Optional[bool] = None
    is_available: Optional[bool] = None


class OrderItemIn(BaseModel):
    menu_item_id: str
    quantity: int
    price: float
    name: str


class OrderIn(BaseModel):
    restaurant_id: str
    table_id: str
    items: List[OrderItemIn]
    special_instructions: str = ""


class OrderStatusIn(BaseModel):
    status: str  # pending, confirmed, preparing, ready, served, cancelled


class TableIn(BaseModel):
    table_number: str
    restaurant_id: Optional[str] = None


# ---------- WebSocket Manager ----------
class WSManager:
    def __init__(self):
        self.active: Dict[str, List[WebSocket]] = {}

    async def connect(self, restaurant_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active.setdefault(restaurant_id, []).append(websocket)

    def disconnect(self, restaurant_id: str, websocket: WebSocket):
        if restaurant_id in self.active:
            try:
                self.active[restaurant_id].remove(websocket)
            except ValueError:
                pass

    async def broadcast(self, restaurant_id: str, message: dict):
        conns = list(self.active.get(restaurant_id, []))
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(restaurant_id, ws)


ws_manager = WSManager()


# ---------- Auth Routes ----------
@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email, user.get("role", "owner"))
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=7 * 24 * 3600, path="/",
    )
    return {
        "token": token,
        "user": {
            "id": user["id"], "email": user["email"], "name": user.get("name"),
            "role": user.get("role"), "restaurant_id": user.get("restaurant_id"),
        },
    }


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(current=Depends(get_current_user)):
    return current


# ---------- Restaurant ----------
@api.get("/restaurants/default")
async def default_restaurant():
    r = await db.restaurants.find_one({}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="No restaurant seeded")
    return r


# ---------- Menu (public) ----------
@api.get("/menu/{restaurant_id}")
async def get_menu(restaurant_id: str):
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(404, "Restaurant not found")
    categories = await db.categories.find(
        {"restaurant_id": restaurant_id}, {"_id": 0}
    ).sort("sort_order", 1).to_list(500)
    items = await db.menu_items.find({"restaurant_id": restaurant_id}, {"_id": 0}).to_list(1000)
    return {"restaurant": restaurant, "categories": categories, "items": items}


# ---------- Menu Management ----------
@api.post("/menu/category")
async def add_category(body: CategoryIn, current=Depends(get_current_user)):
    rid = body.restaurant_id or current.get("restaurant_id")
    cat = {
        "id": str(uuid.uuid4()), "name": body.name,
        "sort_order": body.sort_order, "restaurant_id": rid,
        "created_at": now_utc_iso(),
    }
    await db.categories.insert_one(cat.copy())
    cat.pop("_id", None)
    return cat


@api.put("/menu/category/{cat_id}")
async def update_category(cat_id: str, body: CategoryIn, current=Depends(get_current_user)):
    update = {"name": body.name, "sort_order": body.sort_order}
    res = await db.categories.update_one({"id": cat_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Category not found")
    cat = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    return cat


@api.delete("/menu/category/{cat_id}")
async def delete_category(cat_id: str, current=Depends(get_current_user)):
    await db.categories.delete_one({"id": cat_id})
    await db.menu_items.delete_many({"category_id": cat_id})
    return {"ok": True}


@api.post("/menu/item")
async def add_item(body: MenuItemIn, current=Depends(get_current_user)):
    rid = body.restaurant_id or current.get("restaurant_id")
    item = {
        "id": str(uuid.uuid4()),
        "name": body.name, "description": body.description, "price": body.price,
        "image_url": body.image_url, "category_id": body.category_id,
        "is_veg": body.is_veg, "is_available": body.is_available,
        "restaurant_id": rid, "created_at": now_utc_iso(),
    }
    await db.menu_items.insert_one(item.copy())
    item.pop("_id", None)
    return item


@api.put("/menu/item/{item_id}")
async def update_item(item_id: str, body: MenuItemPatch, current=Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    res = await db.menu_items.update_one({"id": item_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Item not found")
    return await db.menu_items.find_one({"id": item_id}, {"_id": 0})


@api.delete("/menu/item/{item_id}")
async def delete_item(item_id: str, current=Depends(get_current_user)):
    await db.menu_items.delete_one({"id": item_id})
    return {"ok": True}


@api.patch("/menu/item/{item_id}/toggle")
async def toggle_item(item_id: str, current=Depends(get_current_user)):
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Item not found")
    new_val = not item.get("is_available", True)
    await db.menu_items.update_one({"id": item_id}, {"$set": {"is_available": new_val}})
    item["is_available"] = new_val
    return item


# ---------- Upload ----------
@api.post("/upload/menu-image")
async def upload_menu_image(file: UploadFile = File(...), current=Depends(get_current_user)):
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg").lower()
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        raise HTTPException(400, "Unsupported image type")
    name = f"{uuid.uuid4()}.{ext}"
    path = UPLOAD_DIR / "menu" / name
    content = await file.read()
    path.write_bytes(content)
    return {"url": f"/uploads/menu/{name}"}


# ---------- Tables ----------
def generate_qr_png(data: str, out_path: Path):
    img = qrcode.make(data)
    img.save(str(out_path))


@api.get("/tables")
async def list_tables(restaurant_id: Optional[str] = None, current=Depends(get_current_user)):
    rid = restaurant_id or current.get("restaurant_id")
    tables = await db.tables.find({"restaurant_id": rid}, {"_id": 0}).sort("table_number", 1).to_list(500)
    return tables


@api.get("/tables/public")
async def list_tables_public(restaurant_id: str):
    tables = await db.tables.find({"restaurant_id": restaurant_id}, {"_id": 0}).to_list(500)
    return tables


@api.post("/tables")
async def add_table(body: TableIn, request: Request, current=Depends(get_current_user)):
    rid = body.restaurant_id or current.get("restaurant_id")
    table_id = str(uuid.uuid4())
    # Frontend URL (strip /api from backend URL origin — use frontend origin from env if available)
    frontend_base = os.environ.get("FRONTEND_URL", "")
    if not frontend_base:
        # fallback: use request origin header
        frontend_base = request.headers.get("origin", "")
    qr_target = f"{frontend_base}/menu?restaurant={rid}&table={body.table_number}"
    qr_filename = f"{table_id}.png"
    qr_path = UPLOAD_DIR / "qr" / qr_filename
    generate_qr_png(qr_target, qr_path)
    doc = {
        "id": table_id, "table_number": body.table_number, "restaurant_id": rid,
        "qr_code_url": f"/uploads/qr/{qr_filename}", "qr_target": qr_target,
        "created_at": now_utc_iso(),
    }
    await db.tables.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@api.delete("/tables/{table_id}")
async def delete_table(table_id: str, current=Depends(get_current_user)):
    t = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if t and t.get("qr_code_url"):
        fname = t["qr_code_url"].split("/")[-1]
        p = UPLOAD_DIR / "qr" / fname
        if p.exists():
            p.unlink()
    await db.tables.delete_one({"id": table_id})
    return {"ok": True}


@api.get("/tables/{table_id}/qr")
async def get_table_qr(table_id: str):
    t = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Table not found")
    fname = t["qr_code_url"].split("/")[-1]
    p = UPLOAD_DIR / "qr" / fname
    if not p.exists():
        raise HTTPException(404, "QR image missing")
    return FileResponse(str(p), media_type="image/png", filename=f"table-{t['table_number']}.png")


# ---------- Orders ----------
ORDER_STATUSES = ["pending", "confirmed", "preparing", "ready", "served", "cancelled"]


@api.post("/orders")
async def place_order(body: OrderIn):
    # verify table
    table = await db.tables.find_one({"id": body.table_id}, {"_id": 0})
    if not table:
        raise HTTPException(404, "Table not found")
    # compute total + snapshot items
    total = 0.0
    order_items = []
    for it in body.items:
        line = round(it.price * it.quantity, 2)
        total += line
        order_items.append({
            "id": str(uuid.uuid4()), "menu_item_id": it.menu_item_id,
            "name": it.name, "quantity": it.quantity, "price": it.price, "line_total": line,
        })
    # short order number
    count = await db.orders.count_documents({"restaurant_id": body.restaurant_id})
    order_number = f"#{1000 + count + 1}"
    order = {
        "id": str(uuid.uuid4()), "order_number": order_number,
        "restaurant_id": body.restaurant_id, "table_id": body.table_id,
        "table_number": table.get("table_number"),
        "items": order_items, "total_amount": round(total, 2),
        "status": "pending", "special_instructions": body.special_instructions,
        "created_at": now_utc_iso(), "updated_at": now_utc_iso(),
    }
    await db.orders.insert_one(order.copy())
    order.pop("_id", None)
    await ws_manager.broadcast(body.restaurant_id, {"type": "new_order", "order": order})
    return order


@api.get("/orders")
async def list_orders(
    restaurant_id: Optional[str] = None,
    status: Optional[str] = None,
    date: Optional[str] = None,
    current=Depends(get_current_user),
):
    rid = restaurant_id or current.get("restaurant_id")
    q: dict = {"restaurant_id": rid}
    if status and status != "all":
        q["status"] = status
    if date:
        q["created_at"] = {"$gte": f"{date}T00:00:00", "$lt": f"{date}T23:59:59.999999"}
    orders = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return orders


@api.get("/orders/{order_id}")
async def get_order(order_id: str):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    return o


@api.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, body: OrderStatusIn, current=Depends(get_current_user)):
    if body.status not in ORDER_STATUSES:
        raise HTTPException(400, "Invalid status")
    res = await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": body.status, "updated_at": now_utc_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Order not found")
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    await ws_manager.broadcast(order["restaurant_id"], {"type": "order_status_changed", "order": order})
    return order


@api.get("/orders/table/{table_id}")
async def orders_by_table(table_id: str):
    orders = await db.orders.find({"table_id": table_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return orders


# ---------- Dashboard ----------
@api.get("/dashboard/stats")
async def dashboard_stats(restaurant_id: Optional[str] = None, current=Depends(get_current_user)):
    rid = restaurant_id or current.get("restaurant_id")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_orders = await db.orders.find(
        {"restaurant_id": rid, "created_at": {"$gte": f"{today}T00:00:00"}},
        {"_id": 0},
    ).to_list(5000)
    revenue = sum(o["total_amount"] for o in today_orders if o["status"] != "cancelled")
    pending = sum(1 for o in today_orders if o["status"] == "pending")
    # popular items (all time)
    pipeline = [
        {"$match": {"restaurant_id": rid}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.name", "count": {"$sum": "$items.quantity"}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    popular = []
    async for doc in db.orders.aggregate(pipeline):
        popular.append({"name": doc["_id"], "count": doc["count"]})
    # hourly distribution today
    hourly = [0] * 24
    for o in today_orders:
        try:
            h = datetime.fromisoformat(o["created_at"]).hour
            hourly[h] += 1
        except Exception:
            pass
    return {
        "today_revenue": round(revenue, 2),
        "today_orders": len(today_orders),
        "pending_orders": pending,
        "popular_items": popular,
        "hourly": [{"hour": f"{i:02d}:00", "orders": hourly[i]} for i in range(24)],
    }


# ---------- WebSocket ----------
@app.websocket("/ws/{restaurant_id}")
async def websocket_endpoint(websocket: WebSocket, restaurant_id: str):
    await ws_manager.connect(restaurant_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(restaurant_id, websocket)
    except Exception:
        ws_manager.disconnect(restaurant_id, websocket)


# ---------- Seed ----------
async def seed_demo():
    # restaurant
    r = await db.restaurants.find_one({"slug": "demo"}, {"_id": 0})
    if not r:
        rid = str(uuid.uuid4())
        r = {
            "id": rid, "slug": "demo", "name": "Ember & Oak",
            "logo_url": "", "address": "12 Marine Drive, Mumbai",
            "owner_id": None, "created_at": now_utc_iso(),
        }
        await db.restaurants.insert_one(r.copy())
    restaurant_id = r["id"]

    # owner user
    owner = await db.users.find_one({"email": os.environ["ADMIN_EMAIL"]})
    if not owner:
        uid = str(uuid.uuid4())
        owner = {
            "id": uid, "email": os.environ["ADMIN_EMAIL"],
            "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]),
            "name": "Restaurant Owner", "role": "owner",
            "restaurant_id": restaurant_id, "created_at": now_utc_iso(),
        }
        await db.users.insert_one(owner.copy())
        await db.restaurants.update_one({"id": restaurant_id}, {"$set": {"owner_id": uid}})
    else:
        # ensure password is current & restaurant linked
        if not verify_password(os.environ["ADMIN_PASSWORD"], owner["password_hash"]):
            await db.users.update_one(
                {"email": os.environ["ADMIN_EMAIL"]},
                {"$set": {"password_hash": hash_password(os.environ["ADMIN_PASSWORD"]),
                          "restaurant_id": restaurant_id}},
            )

    # categories
    if await db.categories.count_documents({"restaurant_id": restaurant_id}) == 0:
        cats = [
            {"name": "Starters", "sort_order": 1},
            {"name": "Mains", "sort_order": 2},
            {"name": "Pizzas & Pasta", "sort_order": 3},
            {"name": "Desserts & Drinks", "sort_order": 4},
        ]
        cat_ids = {}
        for c in cats:
            doc = {"id": str(uuid.uuid4()), "restaurant_id": restaurant_id,
                   "created_at": now_utc_iso(), **c}
            await db.categories.insert_one(doc.copy())
            cat_ids[c["name"]] = doc["id"]

        BURGER = "https://images.pexels.com/photos/12325012/pexels-photo-12325012.jpeg"
        PIZZA = "https://images.pexels.com/photos/27582703/pexels-photo-27582703.jpeg"
        PASTA = "https://images.pexels.com/photos/24289216/pexels-photo-24289216.jpeg"
        SALAD = "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800"
        STEAK = "https://images.unsplash.com/photo-1544025162-d76694265947?w=800"
        PANEER = "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800"
        CHEESE = "https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?w=800"
        TIRAMISU = "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800"

        items = [
            {"name": "Smoked Paneer Tikka", "description": "Wood-fire roasted paneer, mint chutney", "price": 320, "is_veg": True, "image_url": PANEER, "category": "Starters"},
            {"name": "Crispy Cheese Bites", "description": "Golden mozzarella, truffle aioli", "price": 280, "is_veg": True, "image_url": CHEESE, "category": "Starters"},
            {"name": "Ember Smash Burger", "description": "Double patty, aged cheddar, brioche", "price": 480, "is_veg": False, "image_url": BURGER, "category": "Mains"},
            {"name": "Fire-grilled Steak", "description": "240g ribeye, peppercorn jus", "price": 890, "is_veg": False, "image_url": STEAK, "category": "Mains"},
            {"name": "Garden Citrus Salad", "description": "Baby greens, citrus, toasted nuts", "price": 240, "is_veg": True, "image_url": SALAD, "category": "Mains"},
            {"name": "Truffle Margherita", "description": "San Marzano, buffalo mozz, black truffle", "price": 520, "is_veg": True, "image_url": PIZZA, "category": "Pizzas & Pasta"},
            {"name": "Creamy Mushroom Pasta", "description": "Porcini, cream, parmesan", "price": 420, "is_veg": True, "image_url": PASTA, "category": "Pizzas & Pasta"},
            {"name": "House Tiramisu", "description": "Mascarpone, espresso, cocoa", "price": 260, "is_veg": True, "image_url": TIRAMISU, "category": "Desserts & Drinks"},
        ]
        for it in items:
            doc = {
                "id": str(uuid.uuid4()), "restaurant_id": restaurant_id,
                "name": it["name"], "description": it["description"], "price": it["price"],
                "image_url": it["image_url"], "category_id": cat_ids[it["category"]],
                "is_veg": it["is_veg"], "is_available": True, "created_at": now_utc_iso(),
            }
            await db.menu_items.insert_one(doc.copy())

    # tables
    if await db.tables.count_documents({"restaurant_id": restaurant_id}) == 0:
        frontend_base = os.environ.get("FRONTEND_URL", "")
        for n in range(1, 7):
            tid = str(uuid.uuid4())
            qr_target = f"{frontend_base}/menu?restaurant={restaurant_id}&table={n}"
            qr_filename = f"{tid}.png"
            generate_qr_png(qr_target, UPLOAD_DIR / "qr" / qr_filename)
            await db.tables.insert_one({
                "id": tid, "table_number": str(n), "restaurant_id": restaurant_id,
                "qr_code_url": f"/uploads/qr/{qr_filename}", "qr_target": qr_target,
                "created_at": now_utc_iso(),
            })


# ---------- App Lifecycle ----------
app.include_router(api)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.orders.create_index("restaurant_id")
    await db.menu_items.create_index("restaurant_id")
    await db.categories.create_index("restaurant_id")
    await db.tables.create_index("restaurant_id")
    await seed_demo()
    logger.info("Startup complete")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


@app.get("/")
async def root():
    return {"service": "restaurant-qr-api", "status": "ok"}
