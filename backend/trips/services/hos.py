"""
Hours-of-Service planner for a property-carrying driver (49 CFR Part 395).

Rules applied (70-hour / 8-day carrier, no adverse driving conditions):
  * 11-hour driving limit inside a 14-hour on-duty window after 10 consecutive hours off.
  * 30-minute break from driving once 8 cumulative driving hours have passed since the last
    30+ minute non-driving period (an on-duty fuel stop of 30 min satisfies this).
  * 70 hours on duty in 8 days; once reached, no more driving until a 34-hour restart.
  * Fuel stop (30 min, on duty) at least every 1,000 miles.
  * 1 hour on duty (not driving) for pickup and for drop-off.
  * 30 minutes on duty for pre-trip inspection at the start of the trip.

All timestamps are treated as "home terminal" wall-clock time (naive), as the regulations require
the log to be kept in the time zone of the driver's home terminal.
"""
from __future__ import annotations

import math
from bisect import bisect_right
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from .geocode import reverse

# --- Limits ---------------------------------------------------------------------------------
MAX_DRIVING_HOURS = 11.0
DUTY_WINDOW_HOURS = 14.0
BREAK_AFTER_DRIVING_HOURS = 8.0
BREAK_HOURS = 0.5
DAILY_REST_HOURS = 10.0
CYCLE_LIMIT_HOURS = 70.0
RESTART_HOURS = 34.0
FUEL_INTERVAL_MILES = 1000.0
FUEL_STOP_HOURS = 0.5
PICKUP_HOURS = 1.0
DROPOFF_HOURS = 1.0
PRETRIP_HOURS = 0.5
MAX_TRUCK_MPH = 60.0
MIN_TRUCK_MPH = 35.0
EPS = 1e-6

OFF, SLEEPER, DRIVING, ON_DUTY = "off_duty", "sleeper", "driving", "on_duty"


@dataclass
class Segment:
    status: str
    start: datetime
    end: datetime
    start_mile: float
    end_mile: float
    kind: str  # pretrip | drive | break | fuel | rest | restart | pickup | dropoff | end
    label: str
    location: str = ""
    lat: float = 0.0
    lon: float = 0.0
    cycle_after: float = 0.0

    @property
    def hours(self) -> float:
        return (self.end - self.start).total_seconds() / 3600.0


@dataclass
class DriverState:
    t: datetime
    cycle_used: float
    drive_today: float = 0.0
    since_break: float = 0.0
    window_start: datetime | None = None
    miles_since_fuel: float = 0.0
    odometer: float = 0.0
    segments: list = field(default_factory=list)


# --- Geometry helpers -----------------------------------------------------------------------
def _haversine_miles(a, b) -> float:
    r = 3958.7613
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


class RouteLine:
    """Lets us ask 'where on the route is mile X?'."""

    def __init__(self, geometry: list, total_miles: float):
        self.points = geometry
        cum = [0.0]
        for i in range(1, len(geometry)):
            cum.append(cum[-1] + _haversine_miles(geometry[i - 1], geometry[i]))
        # scale haversine length onto the routed road distance so miles line up with OSRM legs
        scale = total_miles / cum[-1] if cum[-1] > 0 else 1.0
        self.cum = [c * scale for c in cum]
        self.total = total_miles

    def point_at(self, mile: float):
        if not self.points:
            return (0.0, 0.0)
        mile = max(0.0, min(mile, self.cum[-1]))
        i = bisect_right(self.cum, mile) - 1
        if i >= len(self.points) - 1:
            return tuple(self.points[-1])
        seg = self.cum[i + 1] - self.cum[i]
        f = 0 if seg <= 0 else (mile - self.cum[i]) / seg
        a, b = self.points[i], self.points[i + 1]
        return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)


# --- Simulation -----------------------------------------------------------------------------
def _truck_speed(leg: dict) -> float:
    if leg["duration_hours"] <= 0:
        return 50.0
    mph = leg["distance_miles"] / leg["duration_hours"]
    return max(MIN_TRUCK_MPH, min(MAX_TRUCK_MPH, mph))


def _add(state: DriverState, status: str, hours: float, kind: str, label: str, miles: float = 0.0, line: RouteLine | None = None):
    start = state.t
    end = start + timedelta(hours=hours)
    lat, lon = line.point_at(state.odometer) if line else (0.0, 0.0)
    seg = Segment(status, start, end, state.odometer, state.odometer + miles, kind, label, lat=lat, lon=lon)
    state.segments.append(seg)
    state.t = end
    state.odometer += miles
    if status in (DRIVING, ON_DUTY):
        state.cycle_used += hours
        if state.window_start is None:
            state.window_start = start
    seg.cycle_after = state.cycle_used
    if status == DRIVING:
        state.drive_today += hours
        state.since_break += hours
        state.miles_since_fuel += miles
    elif hours >= BREAK_HOURS - EPS:
        state.since_break = 0.0  # any 30+ min non-driving period satisfies the break
    return seg


def _rest(state: DriverState, line: RouteLine):
    _add(state, SLEEPER, DAILY_REST_HOURS, "rest", "10-hour rest (sleeper berth)", line=line)
    state.drive_today = 0.0
    state.since_break = 0.0
    state.window_start = None


def _restart(state: DriverState, line: RouteLine):
    seg = _add(state, OFF, RESTART_HOURS, "restart", "34-hour restart (70-hr cycle reached)", line=line)
    state.cycle_used = 0.0
    seg.cycle_after = 0.0
    state.drive_today = 0.0
    state.since_break = 0.0
    state.window_start = None


def _drive_leg(state: DriverState, miles: float, mph: float, line: RouteLine, leg_name: str):
    remaining = miles
    while remaining > EPS:
        cycle_left = CYCLE_LIMIT_HOURS - state.cycle_used
        if cycle_left <= EPS:
            _restart(state, line)
            continue

        break_left = BREAK_AFTER_DRIVING_HOURS - state.since_break
        if break_left <= EPS:
            _add(state, OFF, BREAK_HOURS, "break", "30-minute rest break", line=line)
            continue

        window_elapsed = 0.0 if state.window_start is None else (state.t - state.window_start).total_seconds() / 3600.0
        window_left = DUTY_WINDOW_HOURS - window_elapsed
        drive_left = MAX_DRIVING_HOURS - state.drive_today
        if window_left <= EPS or drive_left <= EPS:
            _rest(state, line)
            continue

        fuel_left_hours = (FUEL_INTERVAL_MILES - state.miles_since_fuel) / mph
        chunk_hours = min(window_left, drive_left, break_left, cycle_left, fuel_left_hours, remaining / mph)
        if chunk_hours <= EPS:
            # Fuel is due right now
            _add(state, ON_DUTY, FUEL_STOP_HOURS, "fuel", "Fuel stop", line=line)
            state.miles_since_fuel = 0.0
            continue

        chunk_miles = chunk_hours * mph
        _add(state, DRIVING, chunk_hours, "drive", f"Driving — {leg_name}", miles=chunk_miles, line=line)
        remaining -= chunk_miles

        if state.miles_since_fuel >= FUEL_INTERVAL_MILES - EPS and remaining > EPS:
            _add(state, ON_DUTY, FUEL_STOP_HOURS, "fuel", "Fuel stop", line=line)
            state.miles_since_fuel = 0.0


def simulate(legs: list, line: RouteLine, start_time: datetime, cycle_used_hours: float) -> DriverState:
    state = DriverState(t=start_time, cycle_used=float(cycle_used_hours))

    # If the driver has no cycle hours left, they must restart before anything else.
    if CYCLE_LIMIT_HOURS - state.cycle_used <= EPS:
        _restart(state, line)

    _add(state, ON_DUTY, PRETRIP_HOURS, "pretrip", "Pre-trip inspection", line=line)

    to_pickup, to_dropoff = legs[0], legs[1]
    _drive_leg(state, to_pickup["distance_miles"], _truck_speed(to_pickup), line, "to pickup")
    _add(state, ON_DUTY, PICKUP_HOURS, "pickup", "Pickup — loading", line=line)
    _drive_leg(state, to_dropoff["distance_miles"], _truck_speed(to_dropoff), line, "to drop-off")
    _add(state, ON_DUTY, DROPOFF_HOURS, "dropoff", "Drop-off — unloading", line=line)

    # Go off duty for the remainder of the final day so the sheet totals 24 h.
    day_end = (state.t.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1))
    if day_end > state.t:
        _add(state, OFF, (day_end - state.t).total_seconds() / 3600.0, "end", "Off duty — trip complete", line=line)
    return state


# --- Daily log sheets ------------------------------------------------------------------------
def _hour_of_day(t: datetime, day: datetime) -> float:
    return (t - day).total_seconds() / 3600.0


def build_logs(segments: list[Segment], header: dict) -> list[dict]:
    if not segments:
        return []
    first_day = segments[0].start.replace(hour=0, minute=0, second=0, microsecond=0)
    last_day = (segments[-1].end - timedelta(seconds=1)).replace(hour=0, minute=0, second=0, microsecond=0)

    logs = []
    day = first_day
    idx = 0
    while day <= last_day:
        nxt = day + timedelta(days=1)
        day_segs = []
        remarks = []
        miles = 0.0
        totals = {OFF: 0.0, SLEEPER: 0.0, DRIVING: 0.0, ON_DUTY: 0.0}
        cycle_end = None

        # Leading off-duty time before the trip starts on day 1
        if idx == 0 and segments[0].start > day:
            h = _hour_of_day(segments[0].start, day)
            day_segs.append({"status": OFF, "start_hour": 0.0, "end_hour": h, "label": "Off duty", "location": ""})
            totals[OFF] += h

        for s in segments:
            if s.end <= day or s.start >= nxt:
                continue
            a, b = max(s.start, day), min(s.end, nxt)
            sh, eh = _hour_of_day(a, day), _hour_of_day(b, day)
            frac = (b - a).total_seconds() / max((s.end - s.start).total_seconds(), 1)
            seg_miles = (s.end_mile - s.start_mile) * frac
            miles += seg_miles
            totals[s.status] += eh - sh
            cycle_end = s.cycle_after
            day_segs.append({
                "status": s.status, "start_hour": round(sh, 3), "end_hour": round(eh, 3),
                "label": s.label, "kind": s.kind, "location": s.location,
                "miles": round(seg_miles, 1),
            })
            if s.start >= day and s.kind != "drive":
                remarks.append({"hour": round(sh, 3), "text": f"{s.location} — {s.label}" if s.location else s.label})
            elif s.start >= day and s.kind == "drive" and s.start == segments[0].start:
                remarks.append({"hour": round(sh, 3), "text": s.location})

        if not day_segs:
            day += timedelta(days=1)
            idx += 1
            continue

        from_loc = next((s["location"] for s in day_segs if s.get("location")), "")
        to_loc = next((s["location"] for s in reversed(day_segs) if s.get("location")), from_loc)
        logs.append({
            "day_index": len(logs) + 1,
            "date": day.date().isoformat(),
            "from": from_loc,
            "to": to_loc,
            "total_miles": round(miles),
            "segments": day_segs,
            "totals": {k: round(v, 2) for k, v in totals.items()},
            "remarks": remarks,
            "header": header,
            "cycle_used_end": round(cycle_end or 0.0, 2),
            "cycle_available_tomorrow": round(max(0.0, CYCLE_LIMIT_HOURS - (cycle_end or 0.0)), 2),
        })
        day += timedelta(days=1)
        idx += 1
    return logs


# --- Public entry point ----------------------------------------------------------------------
def plan_hos(legs: list, geometry: list, start_time: datetime, cycle_used_hours: float, waypoints: dict, header: dict) -> dict:
    start = start_time.replace(tzinfo=None, second=0, microsecond=0)
    total_miles = sum(l["distance_miles"] for l in legs)
    line = RouteLine(geometry, total_miles)
    state = simulate(legs, line, start, cycle_used_hours)

    # Name the places where duty status changes (Remarks column requirement)
    pickup_mile = legs[0]["distance_miles"]
    for s in state.segments:
        if s.kind == "pretrip":
            s.location = waypoints["current"]["short"]
        elif s.kind == "pickup":
            s.location = waypoints["pickup"]["short"]
        elif s.kind in ("dropoff", "end"):
            s.location = waypoints["dropoff"]["short"]
        elif s.kind == "drive":
            # driving starts from wherever the previous stop was
            s.location = ""
        else:
            s.location = reverse(s.lat, s.lon)
    # Fill driving-segment locations from the preceding stop
    prev = waypoints["current"]["short"]
    for s in state.segments:
        if s.kind == "drive":
            s.location = prev
        elif s.location:
            prev = s.location

    stops = [{
        "kind": s.kind, "label": s.label, "location": s.location, "lat": s.lat, "lon": s.lon,
        "start": s.start.isoformat(), "end": s.end.isoformat(), "duration_hours": round(s.hours, 2),
        "mile": round(s.start_mile), "status": s.status,
    } for s in state.segments if s.kind not in ("drive", "end")]

    segments = [{
        "status": s.status, "kind": s.kind, "label": s.label, "location": s.location,
        "start": s.start.isoformat(), "end": s.end.isoformat(), "hours": round(s.hours, 2),
        "start_mile": round(s.start_mile, 1), "end_mile": round(s.end_mile, 1), "lat": s.lat, "lon": s.lon,
    } for s in state.segments]

    driving_hours = sum(s.hours for s in state.segments if s.status == DRIVING)
    on_duty_hours = sum(s.hours for s in state.segments if s.status in (DRIVING, ON_DUTY))
    trip_end = next((s.start for s in reversed(state.segments) if s.kind == "dropoff"), state.t) + timedelta(hours=DROPOFF_HOURS)

    logs = build_logs(state.segments, header)
    return {
        "summary": {
            "total_miles": round(total_miles),
            "to_pickup_miles": round(legs[0]["distance_miles"]),
            "to_dropoff_miles": round(legs[1]["distance_miles"]),
            "driving_hours": round(driving_hours, 2),
            "on_duty_hours": round(on_duty_hours, 2),
            "trip_hours": round((trip_end - start).total_seconds() / 3600.0, 2),
            "start": start.isoformat(),
            "end": trip_end.isoformat(),
            "days": len(logs),
            "fuel_stops": sum(1 for s in stops if s["kind"] == "fuel"),
            "rest_periods": sum(1 for s in stops if s["kind"] == "rest"),
            "breaks": sum(1 for s in stops if s["kind"] == "break"),
            "restarts": sum(1 for s in stops if s["kind"] == "restart"),
            "cycle_used_start": round(cycle_used_hours, 2),
            "cycle_used_end": round(state.cycle_used, 2),
        },
        "route": {
            "geometry": geometry,
            "waypoints": waypoints,
            "pickup_mile": round(pickup_mile),
        },
        "stops": stops,
        "segments": segments,
        "logs": logs,
        "assumptions": [
            "Property-carrying driver on the 70-hour / 8-day cycle; no adverse driving conditions.",
            "11-hour driving limit within a 14-hour window; 10 consecutive hours in the sleeper berth resets both.",
            "30-minute break after 8 cumulative driving hours (an on-duty fuel stop satisfies it).",
            "Fuel stop (30 min) at least every 1,000 miles.",
            "1 hour on duty for pickup and 1 hour for drop-off; 30 min pre-trip inspection.",
            "When 70 hours are reached, a 34-hour restart is taken before driving resumes.",
            "Times are shown in home-terminal time, as required for the Record of Duty Status.",
        ],
    }
