"""I-405 commute tolls. Trip IDs verified against WSDOT GetTollRatesAsJson.

NB: mainline Bellevue/NE 4th entry, SR 522 destination zone (128th/160th).
SB: first toll board after entering from NE 160th, named NE 145th by WSDOT.
Use GetTollRatesAsJson: CurrentToll is cents and TimeUpdated tracks the rate.
The trip-message feed can lag behind current rates by more than five minutes.
"""
import math
import re
import time
from datetime import datetime, timezone

import requests
from flask import Blueprint, jsonify

tolls_bp = Blueprint("tolls", __name__)
TOLL_URL = "https://www.wsdot.wa.gov/Traffic/api/TollRates/TollRatesREST.svc/GetTollRatesAsJson"
COMMUTE_TRIPS = {"northbound": "405tp01352", "southbound": "405tp02162"}
MAX_AGE_SECONDS = 300


def normalize_toll(trip, now):
    result = {"amount": None, "status": "unavailable", "message": None, "updatedAt": None}
    if not trip:
        return result
    match = re.fullmatch(r"/Date\((-?\d+)(?:[+-]\d+)?\)/", str(trip.get("TimeUpdated", "")))
    if not match:
        return result
    timestamp = int(match[1]) / 1000
    if timestamp <= 0 or timestamp > now + 60:
        return result
    result["updatedAt"] = datetime.fromtimestamp(timestamp, timezone.utc).isoformat()
    if now - timestamp > MAX_AGE_SECONDS:
        return {**result, "status": "stale"}
    message = str(trip.get("CurrentMessage") or "").strip()
    result["message"] = message or None
    # A closed/HOV-only sign overrides the numeric value (often zero).
    if message and message.upper() != "FREE" and not re.fullmatch(r"\$?\d+(?:\.\d{1,2})?", message):
        return {**result, "status": "restricted"}
    amount = trip.get("CurrentToll")
    if isinstance(amount, bool) or not isinstance(amount, (int, float)) or not math.isfinite(amount) or amount < 0:
        return result
    if message.upper() == "FREE" and amount != 0:
        return result
    return {**result, "amount": round(amount / 100, 2), "status": "free" if amount == 0 else "priced"}


def select_commute_tolls(payload, now=None):
    now = time.time() if now is None else now
    if not isinstance(payload, list):
        raise ValueError("Unexpected toll response")
    trips = {trip.get("TripName"): trip for trip in payload if isinstance(trip, dict)}
    return {direction: {"tripName": trip_id, **normalize_toll(trips.get(trip_id), now)} for direction, trip_id in COMMUTE_TRIPS.items()}


@tolls_bp.get("/api/wsdot/tolls")
def commute_tolls():
    import os
    access_code = os.environ.get("WSDOT_ACCESS_CODE", "").strip()
    if not access_code:
        return jsonify({"error": "Server is not configured with WSDOT_ACCESS_CODE"}), 500
    try:
        with requests.Session() as session:
            session.trust_env = False
            response = session.get(TOLL_URL, params={"AccessCode": access_code}, timeout=15)
            response.raise_for_status()
            result = jsonify(select_commute_tolls(response.json()))
            result.headers["Cache-Control"] = "no-store"
            return result
    except (requests.RequestException, ValueError, OverflowError):
        # Do not log request URLs, which contain the access code.
        return jsonify({"error": "WSDOT toll rates unavailable"}), 502
