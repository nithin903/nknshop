#!/usr/bin/env python3
"""Serve the shop and create Shiprocket orders on POST /api/book."""

from __future__ import annotations

import json
import os
import time
import uuid
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
PREVIEW = ROOT / "preview"
ENV_FILE = ROOT / ".env"
SHIPROCKET_AUTH = "https://apiv2.shiprocket.in/v1/external/auth/login"
SHIPROCKET_ORDER = "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc"

TOKEN = {"value": None, "exp": 0.0}


def load_env() -> dict[str, str]:
    data: dict[str, str] = {}
    if ENV_FILE.exists():
        for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            data[key.strip()] = val.strip().strip('"').strip("'")
    data.update({k: v for k, v in os.environ.items() if k.startswith("SHIPROCKET_")})
    return data


def http_json(url: str, payload: dict | None = None, token: str | None = None) -> dict:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = Request(url, data=body, headers=headers, method="POST")
    try:
        with urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {"message": raw or err.reason}
        parsed["_http"] = err.code
        raise RuntimeError(json.dumps(parsed)) from err
    except URLError as err:
        raise RuntimeError(json.dumps({"message": str(err.reason)})) from err


def shiprocket_token(env: dict[str, str], force: bool = False) -> str:
    now = time.time()
    if not force and TOKEN["value"] and TOKEN["exp"] > now + 60:
        return str(TOKEN["value"])
    email = env.get("SHIPROCKET_EMAIL", "")
    password = env.get("SHIPROCKET_PASSWORD", "")
    if not email or not password:
        raise RuntimeError(
            json.dumps(
                {
                    "message": "Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD to the .env file."
                }
            )
        )
    data = http_json(SHIPROCKET_AUTH, {"email": email, "password": password})
    token = data.get("token")
    if not token:
        raise RuntimeError(json.dumps({"message": "Shiprocket login failed.", "detail": data}))
    TOKEN["value"] = token
    TOKEN["exp"] = now + 8 * 24 * 3600
    return token


def parse_price(value: str) -> float:
    digits = "".join(ch if ch.isdigit() or ch == "." else " " for ch in (value or ""))
    parts = [p for p in digits.split() if p]
    try:
        return float(parts[0]) if parts else 0.0
    except ValueError:
        return 0.0


def sku_for(name: str) -> str:
    key = (name or "").lower()
    if "airpod" in key:
        return "NKN-AIRPODS-PRO-2"
    if "samsung" in key or "akg" in key:
        return "NKN-SAMSUNG-AKG"
    if "cable" in key or "usb" in key:
        return "NKN-USBC-60W"
    if "juice" in key or "blender" in key:
        return "NKN-JUICER-NG01"
    slug = "".join(ch if ch.isalnum() else "-" for ch in key)[:24].strip("-")
    return f"NKN-{slug or 'ITEM'}"


def split_name(full: str) -> tuple[str, str]:
    parts = (full or "Customer").strip().split()
    first = parts[0]
    last = " ".join(parts[1:]) if len(parts) > 1 else ""
    return first, last


def digits_phone(value: str) -> str:
    nums = "".join(ch for ch in (value or "") if ch.isdigit())
    if nums.startswith("91") and len(nums) > 10:
        nums = nums[2:]
    return nums[-10:]


def create_order(env: dict[str, str], booking: dict) -> dict:
    first, last = split_name(str(booking.get("customer") or ""))
    phone = digits_phone(str(booking.get("phone") or ""))
    pincode = "".join(ch for ch in str(booking.get("pincode") or "") if ch.isdigit())
    price = parse_price(str(booking.get("price") or "0"))
    if price <= 0:
        price = 1
    product = (booking.get("product") or "NKNSHOP item").strip()
    order_id = f"NKN-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
    payload = {
        "order_id": order_id,
        "order_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "pickup_location": env.get("SHIPROCKET_PICKUP_LOCATION") or "Primary",
        "billing_customer_name": first,
        "billing_last_name": last,
        "billing_address": (booking.get("address") or "").strip(),
        "billing_address_2": (booking.get("landmark") or "").strip(),
        "billing_city": (booking.get("city") or "").strip(),
        "billing_pincode": pincode,
        "billing_state": (booking.get("state") or "").strip(),
        "billing_country": "India",
        "billing_email": (booking.get("email") or "orders@nknshop.local").strip(),
        "billing_phone": phone,
        "shipping_is_billing": True,
        "order_items": [
            {
                "name": product[:200],
                "sku": sku_for(product),
                "units": 1,
                "selling_price": str(int(round(price))),
                "discount": "",
                "tax": "",
                "hsn": 8518,
            }
        ],
        "payment_method": "COD" if booking.get("cod", True) else "Prepaid",
        "shipping_charges": 0,
        "giftwrap_charges": 0,
        "transaction_charges": 0,
        "total_discount": 0,
        "sub_total": int(round(price)),
        "length": 12,
        "breadth": 12,
        "height": 8,
        "weight": 0.4,
        "comment": (booking.get("photo") or "")[:240],
    }
    token = shiprocket_token(env)
    try:
        result = http_json(SHIPROCKET_ORDER, payload, token)
    except RuntimeError as err:
        detail = str(err)
        if "401" in detail or "token" in detail.lower():
            token = shiprocket_token(env, force=True)
            result = http_json(SHIPROCKET_ORDER, payload, token)
        else:
            raise
    result["local_order_id"] = order_id
    return result


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PREVIEW), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/api/health":
            env = load_env()
            ready = bool(env.get("SHIPROCKET_EMAIL") and env.get("SHIPROCKET_PASSWORD"))
            return self._json(200, {"ok": True, "shiprocket": ready})
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/api/book":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length") or 0)
        try:
            booking = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return self._json(400, {"ok": False, "message": "Invalid JSON."})
        required = ["customer", "phone", "address", "city", "state", "pincode", "product"]
        missing = [key for key in required if not str(booking.get(key) or "").strip()]
        if missing:
            return self._json(400, {"ok": False, "message": f"Missing: {', '.join(missing)}"})
        pincode = "".join(ch for ch in str(booking.get("pincode")) if ch.isdigit())
        if len(pincode) != 6:
            return self._json(400, {"ok": False, "message": "Pincode must be 6 digits."})
        if len(digits_phone(str(booking.get("phone")))) != 10:
            return self._json(400, {"ok": False, "message": "Enter a 10-digit phone number."})
        try:
            created = create_order(load_env(), booking)
        except RuntimeError as err:
            try:
                extra = json.loads(str(err))
            except json.JSONDecodeError:
                extra = {"message": str(err)}
            status = int(extra.pop("_http", 502) or 502)
            extra["ok"] = False
            extra.setdefault("message", "Shiprocket order failed.")
            return self._json(status, extra)
        except Exception as err:
            return self._json(502, {"ok": False, "message": str(err)})
        return self._json(
            200,
            {
                "ok": True,
                "order_id": created.get("order_id") or created.get("local_order_id"),
                "shipment_id": created.get("shipment_id"),
                "awb_code": created.get("awb_code") or created.get("awb"),
                "status": created.get("status"),
                "raw": {k: created.get(k) for k in ("order_id", "shipment_id", "status", "awb_code")},
            },
        )

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args) -> None:
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5500"))
    host = os.environ.get("HOST", "0.0.0.0")
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"NKNSHOP + Shiprocket: http://{host}:{port}")
    print("Put API user email/password in .env then book from the site.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
