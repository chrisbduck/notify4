import os
import re
import time
from typing import Dict, Optional
from urllib.parse import urlencode

import requests
from flask import Blueprint, jsonify

traffic_bp = Blueprint("traffic", __name__)

WSDOT_TRAVEL_TIMES_URL = "http://www.wsdot.wa.gov/Traffic/api/TravelTimes/TravelTimesREST.svc/GetTravelTimesAsJson"
WSDOT_UNAVAILABLE_TIME = 2147483647
WSDOT_DATE_PATTERN = re.compile(r"/Date\((-?\d+)(?:[+-]\d+)?\)/")
DEFAULT_CORRIDOR_KEYWORDS = {
    "SR-520": ("520", "SR 520", "SR-520"),
    "I-90": ("I-90", "I 90", "90"),
    "I-405": ("I-405", "I 405", "405"),
    "I-5 Downtown": ("I-5", "I 5", "5"),
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
        return create_json_error(f"Unexpected error: {exc}", 500)


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
        return create_json_error(f"Unexpected error: {exc}", 500)
