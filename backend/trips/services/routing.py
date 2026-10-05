"""Routing via the public OSRM demo server (free, no key)."""
import requests
from django.conf import settings

METERS_PER_MILE = 1609.344


class RoutingError(Exception):
    pass


def route(points: list) -> dict:
    """points: list of dicts with lat/lon. Returns legs, full geometry and totals."""
    coords = ";".join(f"{p['lon']},{p['lat']}" for p in points)
    url = f"{settings.OSRM_URL}/route/v1/driving/{coords}"
    try:
        r = requests.get(
            url,
            params={"overview": "full", "geometries": "geojson", "steps": "false", "annotations": "false"},
            headers={"User-Agent": settings.USER_AGENT},
            timeout=20,
        )
        r.raise_for_status()
        data = r.json()
    except requests.RequestException as e:
        raise RoutingError(f"Routing service unavailable: {e}") from e

    if data.get("code") != "Ok" or not data.get("routes"):
        raise RoutingError("No drivable route found between those locations.")

    best = data["routes"][0]
    geometry = [[c[1], c[0]] for c in best["geometry"]["coordinates"]]  # -> [lat, lon]
    legs = []
    for leg in best["legs"]:
        miles = leg["distance"] / METERS_PER_MILE
        hours = leg["duration"] / 3600.0
        legs.append({"distance_miles": miles, "duration_hours": hours})

    return {
        "geometry": geometry,
        "legs": legs,
        "distance_miles": best["distance"] / METERS_PER_MILE,
        "duration_hours": best["duration"] / 3600.0,
    }
