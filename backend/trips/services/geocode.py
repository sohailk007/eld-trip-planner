"""Geocoding via OpenStreetMap Nominatim (free, no key). Includes a tiny in-process cache."""
import time
import requests
from django.conf import settings

_cache: dict = {}
_last_call = 0.0


class GeocodeError(Exception):
    pass


def _throttle():
    # Nominatim usage policy: max 1 request / second.
    global _last_call
    wait = 1.0 - (time.time() - _last_call)
    if wait > 0:
        time.sleep(wait)
    _last_call = time.time()


def _get(path, params):
    _throttle()
    try:
        r = requests.get(
            f"{settings.NOMINATIM_URL}{path}",
            params=params,
            headers={"User-Agent": settings.USER_AGENT},
            timeout=12,
        )
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        raise GeocodeError(f"Geocoding service unavailable: {e}") from e


def search(query: str, limit: int = 5) -> list:
    key = ("s", query.lower(), limit)
    if key in _cache:
        return _cache[key]
    data = _get("/search", {"q": query, "format": "jsonv2", "limit": limit, "addressdetails": 1})
    out = [{
        "label": d.get("display_name", ""),
        "lat": float(d["lat"]),
        "lon": float(d["lon"]),
        "short": _short_name(d.get("address", {}), d.get("display_name", "")),
    } for d in data]
    _cache[key] = out
    return out


def geocode(query: str) -> dict:
    results = search(query, limit=1)
    if not results:
        raise GeocodeError(f"Could not find a location for '{query}'. Try adding a city and state.")
    r = results[0]
    return {"query": query, "label": r["label"], "short": r["short"], "lat": r["lat"], "lon": r["lon"]}


def reverse(lat: float, lon: float) -> str:
    """Return 'City, ST' style name for a coordinate (used for log Remarks)."""
    key = ("r", round(lat, 2), round(lon, 2))
    if key in _cache:
        return _cache[key]
    try:
        d = _get("/reverse", {"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 10, "addressdetails": 1})
        name = _short_name(d.get("address", {}), d.get("display_name", "")) or f"{lat:.3f}, {lon:.3f}"
    except GeocodeError:
        name = f"{lat:.3f}, {lon:.3f}"
    _cache[key] = name
    return name


_US_STATES = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA", "colorado": "CO",
    "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
    "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS", "kentucky": "KY", "louisiana": "LA",
    "maine": "ME", "maryland": "MD", "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
    "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
    "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA",
    "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", "tennessee": "TN", "texas": "TX",
    "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
    "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC",
}


def _short_name(addr: dict, fallback: str) -> str:
    city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("hamlet") \
        or addr.get("municipality") or addr.get("county") or ""
    state = addr.get("state") or ""
    state = _US_STATES.get(state.lower(), state)
    if city and state:
        return f"{city}, {state}"
    if city or state:
        return city or state
    return fallback.split(",")[0] if fallback else ""
