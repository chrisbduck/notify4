import logging
import os
import sys
import time
from pathlib import Path
from typing import Dict, Literal, Optional, Union

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


@app.route("/api/download-alerts", methods=["GET"])
def download_alerts():
    """Download and log alerts from Sound Transit feed"""
    url = "https://s3.amazonaws.com/st-service-alerts-prod/alerts_pb.json"
    try:
        response = requests.get(url, timeout=20)
        response.raise_for_status()
        logger.info("Downloaded alerts content: %s", response.text)
        return jsonify({
            "status": "success",
            "message": "Alerts downloaded and logged successfully",
            "bytes": len(response.text),
        })
    except requests.RequestException as e:
        logger.error(f"Failed to download alerts: {e}")
        return jsonify({"status": "error", "message": f"Failed to download alerts: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
