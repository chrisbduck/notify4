import json
import logging
import os
import re
import time
from typing import Dict, Optional
from urllib.parse import urlencode

import requests
from flask import Blueprint, jsonify, request

traffic_bp = Blueprint("traffic", __name__)
logger = logging.getLogger("notify4")

WSDOT_TRAVEL_TIMES_URL = "http://www.wsdot.wa.gov/Traffic/api/TravelTimes/TravelTimesREST.svc/GetTravelTimesAsJson"
WSDOT_HIGHWAY_ALERTS_URL = "http://www.wsdot.wa.gov/Traffic/api/HighwayAlerts/HighwayAlertsREST.svc/GetAlertsAsJson"
WSDOT_UNAVAILABLE_TIME = 2147483647
WSDOT_DATE_PATTERN = re.compile(r"/Date\((-?\d+)(?:[+-]\d+)?\)/")
DEFAULT_CORRIDOR_KEYWORDS = {
    "SR-520": ("520", "SR 520", "SR-520"),
    "I-90": ("I-90", "I 90", "90"),
    "I-405": ("I-405", "I 405", "405"),
    "I-5 Downtown": ("I-5", "I 5", "5"),
}
CORRIDOR_ALERT_CONFIG = {
    "SR-520": {"road_names": ("520",), "milepost_min": 0, "milepost_max": 12},
    "I-90": {"road_names": ("090", "90"), "milepost_min": 0, "milepost_max": 12},
    "I-405": {"road_names": ("405",), "milepost_min": 12, "milepost_max": 23},
    "I-5 Downtown": {"road_names": ("005", "5"), "milepost_min": 162, "milepost_max": 171},
}
RELEVANT_ALERT_CATEGORIES = ("collision", "incident", "disabled", "closure", "construction", "roadwork", "maintenance", "weather")
PRIORITY_RANK = {
    "highest": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
}


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


def get_timestamp_sort_value(updated_at):
    if not isinstance(updated_at, str):
        return 0
    try:
        return int(time.mktime(time.strptime(updated_at, "%Y-%m-%dT%H:%M:%SZ")))
    except (TypeError, ValueError):
        return 0


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
    session = requests.Session()
    session.trust_env = False
    response = session.get(
        f"{WSDOT_TRAVEL_TIMES_URL}?{urlencode({'AccessCode': access_code})}",
        timeout=20,
    )
    if not response.ok:
        raise RuntimeError(f"WSDOT travel-times error {response.status_code}")
    return response.json()


def fetch_wsdot_highway_alerts(access_code: str):
    session = requests.Session()
    session.trust_env = False
    response = session.get(
        f"{WSDOT_HIGHWAY_ALERTS_URL}?{urlencode({'AccessCode': access_code})}",
        timeout=20,
    )
    if not response.ok:
        raise RuntimeError(f"WSDOT highway-alerts error {response.status_code}")
    return response.json()


def route_matches_keywords(route, keywords):
    haystack = " ".join(str(route.get(field) or "") for field in ("Name", "Description")).lower()
    return any(keyword.lower() in haystack for keyword in keywords)


def normalize_road_name(value):
    if value is None:
        return ""
    return str(value).strip().upper().lstrip("0") or "0"


def get_alert_mileposts(alert):
    locations = [alert.get("StartRoadwayLocation"), alert.get("EndRoadwayLocation")]
    mileposts = []
    for location in locations:
        if not isinstance(location, dict):
            continue
        if location.get("Latitude") == 0 and location.get("Longitude") == 0:
            continue
        try:
            mileposts.append(float(location.get("MilePost")))
        except (TypeError, ValueError):
            pass
    return mileposts


def alert_matches_corridor(alert, config):
    locations = [alert.get("StartRoadwayLocation"), alert.get("EndRoadwayLocation")]
    route_names = {normalize_road_name(location.get("RoadName")) for location in locations if isinstance(location, dict)}
    configured_route_names = {normalize_road_name(route_name) for route_name in config["road_names"]}
    if route_names.isdisjoint(configured_route_names):
        return False

    mileposts = get_alert_mileposts(alert)
    if not mileposts:
        return False
    return any(config["milepost_min"] <= milepost <= config["milepost_max"] for milepost in mileposts)


def is_relevant_alert(alert):
    category = str(alert.get("EventCategory") or "").lower()
    priority_rank = PRIORITY_RANK.get(str(alert.get("Priority") or "").strip().lower(), 4)
    if "maintenance" in category and priority_rank >= PRIORITY_RANK["medium"]:
        return False
    return any(relevant in category for relevant in RELEVANT_ALERT_CATEGORIES)


def get_alert_corridor_label(alert):
    for label, config in CORRIDOR_ALERT_CONFIG.items():
        if alert_matches_corridor(alert, config):
            return label
    return None


def normalize_wsdot_alert(alert, corridor_label: str):
    return {
        "id": alert.get("AlertID"),
        "corridorLabel": corridor_label,
        "category": alert.get("EventCategory"),
        "priority": alert.get("Priority"),
        "headline": alert.get("HeadlineDescription"),
        "description": alert.get("ExtendedDescription"),
        "status": alert.get("EventStatus"),
        "updatedAt": normalize_wsdot_timestamp(alert.get("LastUpdatedTime")),
        "start": normalize_wsdot_location(alert.get("StartRoadwayLocation")),
        "end": normalize_wsdot_location(alert.get("EndRoadwayLocation")),
    }


def select_corridor_alerts(alerts):
    selected = []
    for alert in alerts:
        corridor_label = get_alert_corridor_label(alert)
        if not corridor_label or not is_relevant_alert(alert):
            continue
        selected.append(normalize_wsdot_alert(alert, corridor_label))

    return sorted(
        selected,
        key=lambda alert: (
            PRIORITY_RANK.get(str(alert.get("priority") or "").strip().lower(), 4),
            -get_timestamp_sort_value(alert.get("updatedAt")),
        ),
    )


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


@traffic_bp.route("/api/wsdot/highway-alerts", methods=["GET"])
def wsdot_highway_alerts():
    access_code = get_wsdot_access_code()
    if not access_code:
        return create_json_error("Server is not configured with WSDOT_ACCESS_CODE", 500)

    try:
        alerts = fetch_wsdot_highway_alerts(access_code)
        if not isinstance(alerts, list):
            return create_json_error("Unexpected WSDOT highway-alerts response", 502)

        return jsonify({
            "alerts": select_corridor_alerts(alerts),
            "fetched_at": int(time.time()),
        })
    except RuntimeError as exc:
        return create_json_error(str(exc), 502)
    except Exception as exc:
        logger.exception("Unexpected WSDOT highway-alerts error")
        return create_json_error("Unexpected WSDOT highway-alerts error", 500)


@traffic_bp.route("/api/wsdot/highway-alerts/log", methods=["POST"])
def log_wsdot_highway_alerts():
    access_code = get_wsdot_access_code()
    if not access_code:
        return create_json_error("Server is not configured with WSDOT_ACCESS_CODE", 500)

    payload = request.get_json(silent=True) or {}
    message = payload.get("message")
    message = message.strip() if isinstance(message, str) else ""

    try:
        alerts = fetch_wsdot_highway_alerts(access_code)
        alert_json = json.dumps(alerts, ensure_ascii=True)
        if message:
            logger.info("Downloaded WSDOT highway alerts with operator note: %s | payload: %s", message, alert_json)
        else:
            logger.info("Downloaded WSDOT highway alerts: %s", alert_json)

        alert_count = len(alerts) if isinstance(alerts, list) else 0
        return jsonify({
            "status": "success",
            "message": "Highway alerts saved for future inspection.",
            "count": alert_count,
        })
    except RuntimeError as exc:
        return create_json_error(str(exc), 502)
    except Exception as exc:
        logger.exception("Unexpected WSDOT highway-alerts log error")
        return create_json_error("Unexpected WSDOT highway-alerts log error", 500)


@traffic_bp.route("/api/wsdot/travel-times", methods=["GET"])
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
        return create_json_error("Unexpected WSDOT travel-times error", 500)


@traffic_bp.route("/api/wsdot/travel-times/catalog", methods=["GET"])
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
        logger.exception("Unexpected WSDOT travel-time catalog error")
        return create_json_error("Unexpected WSDOT travel-time catalog error", 500)
