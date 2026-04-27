import logging
import os
import re
import sys
import time
from pathlib import Path
from typing import Dict, Literal, Optional, Union
from urllib.parse import urlencode

from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import requests

def _configure_environment():
    project_root = Path(__file__).resolve().parent.parent
    load_dotenv(project_root / ".env.local")
    load_dotenv(project_root / ".env")
    load_dotenv(Path(__file__).resolve().parent / ".env")

_configure_environment()

app = Flask(__name__)
CORS(app)

SENSOR_NAMES: Dict[str, int] = {
    "finn-hill": 156415,
    "mountlake-terrace": 156807,
    "seattle-downtown": 167259,
    "juanita": 102160,
    "north-kirkland": 192162,
    "sunnyvale": 68619,
    "san-francisco": 36529,
    "adelaide": 95971,
    "london": 146146,
    "des-moines": 115301,
    "santa-monica": 92539,
    "bengaluru": 42325,
    "san-diego": 78279,
    "san-rafael": 63895,
    "fremont": 86205,
    "melbourne": 46649,
    "sydney": 104206,
}

AqiCategory = Literal[
    "Good",
    "Moderate",
    "Unhealthy for Sensitive Groups",
    "Unhealthy",
    "Very Unhealthy",
    "Hazardous",
]

RowDict = Dict[str, Optional[Union[int, float, str]]]

WSDOT_TRAVEL_TIMES_URL = "http://www.wsdot.wa.gov/Traffic/api/TravelTimes/TravelTimesREST.svc/GetTravelTimesAsJson"
WSDOT_UNAVAILABLE_TIME = 2147483647
WSDOT_DATE_PATTERN = re.compile(r"/Date\((-?\d+)(?:[+-]\d+)?\)/")
DEFAULT_CORRIDOR_KEYWORDS = {
    "SR-520": ("520", "SR 520", "SR-520"),
    "I-90": ("I-90", "I 90", "90"),
    "I-405": ("I-405", "I 405", "405"),
    "I-5 Downtown": ("I-5", "I 5", "5"),
}

def _configure_logging() -> logging.Logger:
    "Configures logging to stdout so logs are visible in Vercel."
    try:
        logger = logging.getLogger("notify4")
        logger.setLevel(logging.INFO)
        if not logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
            logger.addHandler(handler)
        return logger
    except Exception as e:
        raise RuntimeError(f"Error setting up logging: {e}")

logger = _configure_logging()


def lerp(out0: float, out1: float, in0: float, in1: float, value: float) -> float:
    clamped = min(max(value, in0), in1)
    return out0 + ((clamped - in0) / (in1 - in0)) * (out1 - out0)


def aqi_from_pm25(pm25: float) -> float:
    if pm25 < 0:
        return 0
    if pm25 <= 12.0:
        return lerp(0, 50, 0.0, 12.0, pm25)
    if pm25 <= 35.4:
        return lerp(50, 100, 12.0, 35.4, pm25)
    if pm25 <= 55.4:
        return lerp(100, 150, 35.4, 55.4, pm25)
    if pm25 <= 150.4:
        return lerp(150, 200, 55.4, 150.4, pm25)
    if pm25 <= 250.4:
        return lerp(200, 300, 150.4, 250.4, pm25)
    if pm25 <= 350.4:
        return lerp(300, 400, 250.4, 350.4, pm25)
    if pm25 <= 500.4:
        return lerp(400, 500, 350.4, 500.4, pm25)
    return 501


def category_from_aqi(aqi: float) -> AqiCategory:
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Moderate"
    if aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    if aqi <= 200:
        return "Unhealthy"
    if aqi <= 300:
        return "Very Unhealthy"
    return "Hazardous"


def resolve_sensor_id(sensor: str) -> int:
    normalized = sensor.strip().lower()
    if normalized in SENSOR_NAMES:
        return SENSOR_NAMES[normalized]
    try:
        return int(normalized)
    except ValueError as exc:
        raise ValueError(f"Unrecognized sensor identifier: {sensor}") from exc


def create_json_error(message: str, status_code: int):
    return jsonify({"error": message}), status_code


def get_wsdot_access_code() -> str:
    return os.environ.get("WSDOT_ACCESS_CODE", "").strip()


def parse_wsdot_route_config() -> Dict[str, int]:
    raw_config = os.environ.get("WSDOT_TRAVEL_TIME_ROUTE_IDS", "").strip()
    if not raw_config:
        return {}

    route_ids: Dict[str, int] = {}
    for item in raw_config.split(","):
        entry = item.strip()
        if not entry:
            continue

        if ":" in entry:
            label, route_id = entry.split(":", 1)
            label = label.strip()
            route_id = route_id.strip()
        else:
            label = entry
            route_id = entry

        try:
            route_ids[label] = int(route_id)
        except ValueError as exc:
            raise ValueError("WSDOT_TRAVEL_TIME_ROUTE_IDS must use comma-separated route IDs or label:id pairs") from exc

    return route_ids


def normalize_wsdot_time(value):
    try:
        minutes = int(value)
    except (TypeError, ValueError):
        return None
    if minutes >= WSDOT_UNAVAILABLE_TIME:
        return None
    return minutes


def normalize_wsdot_location(location):
    if not isinstance(location, dict):
        return None
    return {
        "description": location.get("Description"),
        "direction": location.get("Direction"),
        "latitude": location.get("Latitude"),
        "longitude": location.get("Longitude"),
        "milepost": location.get("MilePost"),
        "roadName": location.get("RoadName"),
    }


def normalize_wsdot_timestamp(value):
    if not isinstance(value, str):
        return value

    match = WSDOT_DATE_PATTERN.fullmatch(value)
    if not match:
        return value

    try:
        milliseconds = int(match.group(1))
    except ValueError:
        return value

    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(milliseconds / 1000))


def normalize_wsdot_route(route, label: Optional[str] = None):
    current_minutes = normalize_wsdot_time(route.get("CurrentTime"))
    average_minutes = normalize_wsdot_time(route.get("AverageTime"))
    delay_minutes = current_minutes - average_minutes if current_minutes is not None and average_minutes is not None else None

    return {
        "id": route.get("TravelTimeID"),
        "label": label or route.get("Name") or str(route.get("TravelTimeID")),
        "name": route.get("Name"),
        "description": route.get("Description"),
        "currentMinutes": current_minutes,
        "averageMinutes": average_minutes,
        "delayMinutes": delay_minutes,
        "distanceMiles": route.get("Distance"),
        "updatedAt": normalize_wsdot_timestamp(route.get("TimeUpdated")),
        "start": normalize_wsdot_location(route.get("StartPoint")),
        "end": normalize_wsdot_location(route.get("EndPoint")),
    }


def fetch_wsdot_travel_times(access_code: str):
    response = requests.get(
        f"{WSDOT_TRAVEL_TIMES_URL}?{urlencode({'AccessCode': access_code})}",
        timeout=20,
    )
    if not response.ok:
        raise RuntimeError(f"WSDOT error {response.status_code}: {response.text}")
    return response.json()


def route_matches_keywords(route, keywords):
    haystack = " ".join(str(route.get(field) or "") for field in ("Name", "Description")).lower()
    return any(keyword.lower() in haystack for keyword in keywords)


def select_corridor_routes(routes):
    configured_ids = parse_wsdot_route_config()
    if configured_ids:
        by_id = {route.get("TravelTimeID"): route for route in routes}
        return [
            normalize_wsdot_route(by_id.get(route_id, {"TravelTimeID": route_id}), label)
            for label, route_id in configured_ids.items()
        ]

    selected = []
    used_ids = set()
    for label, keywords in DEFAULT_CORRIDOR_KEYWORDS.items():
        match = next((route for route in routes if route.get("TravelTimeID") not in used_ids and route_matches_keywords(route, keywords)), None)
        if match:
            used_ids.add(match.get("TravelTimeID"))
            selected.append(normalize_wsdot_route(match, label))
        else:
            selected.append({
                "id": None,
                "label": label,
                "name": None,
                "description": "No matching WSDOT travel-time route found. Use the catalog endpoint to choose a route ID.",
                "currentMinutes": None,
                "averageMinutes": None,
                "delayMinutes": None,
                "distanceMiles": None,
                "updatedAt": None,
                "start": None,
                "end": None,
            })
    return selected


def fetch_sensor_row(api_key: str, sensor_index: int, pm_field: str, max_age_minutes: int) -> Optional[RowDict]:
    response = requests.get(
        "https://api.purpleair.com/v1/sensors",
        headers={"X-API-Key": api_key},
        params={
            "fields": ",".join(["sensor_index", "last_seen", pm_field]),
            "show_only": str(sensor_index),
            "max_age": str(max_age_minutes * 60),
        },
        timeout=15,
    )

    if not response.ok:
        raise RuntimeError(f"PurpleAir error {response.status_code}: {response.text}")

    body = response.json()
    data = body.get("data") or []
    if not data:
        return None

    indexes = {field: idx for idx, field in enumerate(body.get("fields", []))}
    row = data[0]
    return {field: row[idx] if idx < len(row) else None for field, idx in indexes.items()}

@app.route("/api/test1", methods=["GET"])
def test_endpoint_1():
    """First test endpoint"""
    logger.info("/api/test1 called - TEST PHRASE: test-endpoint-1-phrase")
    return jsonify({
        "status": "success",
        "message": "Test endpoint 1 is working!",
        "data": {
            "test": "endpoint1",
            "timestamp": "2026-02-22T12:34:56Z"
        }
    })


@app.route("/api/test2", methods=["GET"])
def test_endpoint_2():
    """Second test endpoint"""
    logger.info("/api/test2 called - TEST PHRASE: test-endpoint-2-phrase")
    return jsonify({
        "status": "success",
        "message": "Test endpoint 2 is working!",
        "data": {
            "test": "endpoint2",
            "count": 42,
            "items": ["apple", "banana", "orange", "grape"]
        }
    })


@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy"})


@app.route("/api/aqi", methods=["GET", "POST"])
def aqi():
    api_key = os.environ.get("PURPLEAIR_API_KEY", "").strip()
    if not api_key:
        return create_json_error("Server is not configured with PURPLEAIR_API_KEY", 500)

    payload = request.get_json(silent=True) or {}
    sensor = request.args.get("sensor") or payload.get("sensor") or ""
    if not sensor:
        return create_json_error("Missing 'sensor' parameter", 400)

    pm_field = request.args.get("pmField") or payload.get("pmField") or "pm2.5_alt"
    if pm_field not in ("pm2.5_alt", "pm2.5_atm"):
        return create_json_error("pmField must be 'pm2.5_alt' or 'pm2.5_atm'", 400)

    try:
        max_age_minutes = int(request.args.get("maxAgeMinutes") or payload.get("maxAgeMinutes") or 60)
    except (TypeError, ValueError):
        return create_json_error("maxAgeMinutes must be an integer", 400)
    if max_age_minutes < 0:
        return create_json_error("maxAgeMinutes must be >= 0", 400)

    try:
        sensor_id = resolve_sensor_id(sensor)
        row = fetch_sensor_row(api_key, sensor_id, pm_field, max_age_minutes)
        if not row:
            return jsonify({
                "sensor": sensor,
                "sensor_index": sensor_id,
                "message": "No fresh reading available for this sensor (empty result).",
            }), 404

        pm25_raw = row.get(pm_field)
        try:
            pm25 = float(pm25_raw)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return jsonify({
                "sensor": sensor,
                "sensor_index": sensor_id,
                "message": f"No numeric value for {pm_field}",
            }), 404

        aqi_value = round(aqi_from_pm25(pm25), 1)
        category = category_from_aqi(aqi_value)
        return jsonify({
            "sensor": sensor,
            "sensor_index": sensor_id,
            "pm_field": pm_field,
            "pm25": pm25,
            "aqi": aqi_value,
            "category": category,
            "last_seen": row.get("last_seen"),
            "fetched_at": int(time.time()),
        })
    except ValueError as exc:
        return create_json_error(str(exc), 400)
    except RuntimeError as exc:
        return create_json_error(str(exc), 502)
    except Exception as exc:
        logger.exception("Unexpected AQI error")
        return create_json_error(f"Unexpected error: {exc}", 500)


@app.route("/api/wsdot/travel-times", methods=["GET"])
def wsdot_travel_times():
    access_code = get_wsdot_access_code()
    if not access_code:
        return create_json_error("Server is not configured with WSDOT_ACCESS_CODE", 500)

    try:
        routes = fetch_wsdot_travel_times(access_code)
        if not isinstance(routes, list):
            return create_json_error("Unexpected WSDOT travel-times response", 502)

        return jsonify({
            "corridors": select_corridor_routes(routes),
            "fetched_at": int(time.time()),
            "configured_route_ids": bool(parse_wsdot_route_config()),
        })
    except ValueError as exc:
        return create_json_error(str(exc), 500)
    except RuntimeError as exc:
        return create_json_error(str(exc), 502)
    except Exception as exc:
        logger.exception("Unexpected WSDOT travel-times error")
        return create_json_error(f"Unexpected error: {exc}", 500)


@app.route("/api/wsdot/travel-times/catalog", methods=["GET"])
def wsdot_travel_times_catalog():
    access_code = get_wsdot_access_code()
    if not access_code:
        return create_json_error("Server is not configured with WSDOT_ACCESS_CODE", 500)

    try:
        routes = fetch_wsdot_travel_times(access_code)
        if not isinstance(routes, list):
            return create_json_error("Unexpected WSDOT travel-times response", 502)

        catalog = [
            {
                "id": route.get("TravelTimeID"),
                "name": route.get("Name"),
                "description": route.get("Description"),
                "distanceMiles": route.get("Distance"),
                "currentMinutes": normalize_wsdot_time(route.get("CurrentTime")),
                "averageMinutes": normalize_wsdot_time(route.get("AverageTime")),
                "updatedAt": normalize_wsdot_timestamp(route.get("TimeUpdated")),
                "start": normalize_wsdot_location(route.get("StartPoint")),
                "end": normalize_wsdot_location(route.get("EndPoint")),
            }
            for route in routes
        ]
        return jsonify({"routes": catalog, "count": len(catalog), "fetched_at": int(time.time())})
    except RuntimeError as exc:
        return create_json_error(str(exc), 502)
    except Exception as exc:
        logger.exception("Unexpected WSDOT catalog error")
        return create_json_error(f"Unexpected error: {exc}", 500)


@app.route("/api/download-alerts", methods=["POST"])
def download_alerts():
    """Download and log alerts from Sound Transit feed"""
    url = "https://s3.amazonaws.com/st-service-alerts-prod/alerts_pb.json"
    payload = request.get_json(silent=True) or {}
    message = payload.get("message")
    message = message.strip() if isinstance(message, str) else ""

    try:
        response = requests.get(url, timeout=20)
        response.raise_for_status()
        if message:
            logger.info("Downloaded alerts content with operator note: %s | payload: %s", message, response.text)
        else:
            logger.info("Downloaded alerts content: %s", response.text)
        return jsonify({
            "status": "success",
            "message": "Alerts saved for future inspection.",
            "bytes": len(response.text),
        })
    except requests.RequestException as e:
        logger.error(f"Failed to download alerts: {e}")
        return jsonify({"status": "error", "message": f"Failed to download alerts: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
