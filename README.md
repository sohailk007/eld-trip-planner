# Roadbook — ELD Trip Planner (Django + React)

Takes a trip (current location → pickup → drop-off) and the driver's used 70-hour cycle, routes it with a free map API, simulates FMCSA Hours-of-Service rules mile by mile, and renders filled-in Driver's Daily Log sheets — one per day.

- **Backend:** Django 5 + Django REST Framework (`/backend`)
- **Frontend:** React 18 + TypeScript + Vite, Leaflet map (`/frontend`)
- **Free APIs:** OSRM (routing), OpenStreetMap Nominatim (geocoding), CARTO/OSM tiles (map)

## HOS rules implemented (property-carrying, 70 hr / 8 days)

| Rule | Implementation |
|---|---|
| 11-hour driving limit | Driving stops at 11 h since last 10-h rest |
| 14-hour window | No driving after 14 h on duty since the window opened |
| 30-minute break | After 8 cumulative driving hours; an on-duty fuel stop ≥ 30 min satisfies it |
| 10-hour rest | Taken in the sleeper berth; resets the 11/14-hour clocks |
| 70 hr / 8 days | Cycle hours tracked from the input; at 70 h a 34-hour restart is taken before driving |
| Fuel | 30-min on-duty stop at least every 1,000 miles |
| Pickup / drop-off | 1 hour on duty (not driving) each |
| Pre-trip | 30 min on duty at trip start |

Each log day totals exactly 24 h, lists duty-status changes with city/state in Remarks, shows miles driven that day, and fills the 70-hour recap (A: used, B: available tomorrow).

## Run locally

```bash
# Backend
cd backend
python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver        # http://localhost:8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev                       # http://localhost:5173 (proxies /api → :8000)
```

Run backend tests: `python manage.py test`

## API

`POST /api/trips/plan/`
```json
{
  "current_location": "Dallas, TX",
  "pickup_location": "Oklahoma City, OK",
  "dropoff_location": "Chicago, IL",
  "cycle_used_hours": 32,
  "start_time": "2026-10-06T08:00",
  "driver_name": "optional", "carrier_name": "optional", "truck_number": "optional"
}
```
Returns `summary`, `route` (geometry + waypoints), `stops`, `segments`, `logs[]` and `assumptions`. Also: `GET /api/geocode/?q=`, `GET /api/trips/`, `GET /api/trips/<id>/`.

## Deploy

**Backend → Render (free tier)**
1. New Web Service from this repo, root directory `backend` (or use `backend/render.yaml` as a Blueprint).
2. Build: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
3. Start: `python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
4. Env: `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0`, `ALLOWED_HOSTS=*`, `CORS_ALLOW_ALL=1` (or `CORS_ALLOWED_ORIGINS=https://your-app.vercel.app`).

**Frontend → Vercel**
1. Import repo, root directory `frontend`, framework Vite.
2. Env var `VITE_API_URL=https://<your-render-service>.onrender.com`
3. Deploy. `vercel.json` already handles SPA rewrites.

## Loom walkthrough (3–5 min outline)

1. **Problem (20 s)** — dispatchers need a legal plan, not just a route.
2. **Demo (90 s)** — enter Dallas → Oklahoma City → Chicago, cycle 32 h. Show overview numbers, the map with fuel/rest pins, the stop timeline, then scroll the two log sheets: off-duty → pre-trip → driving → pickup → 10-h sleeper; day 2 fuel stop at mile 1,000 and drop-off.
3. **Edge case (30 s)** — set cycle to 68 h: the planner inserts a 34-hour restart and the recap resets to 0/70.
4. **Code (90 s)** — `trips/services/hos.py`: `DriverState`, the `_drive_leg` loop checking window / drive / break / cycle / fuel limits, `build_logs` splitting at midnight. `LogSheet.tsx`: 24-h grid math (`x(hour)`), the status polyline. `views.py`: geocode → OSRM → plan → persist.
5. **Wrap (20 s)** — tests, deploy, what you'd add (real 8-day history, adverse conditions, PDF export).

## Project layout

```
backend/
  config/            Django settings, urls, wsgi
  trips/
    services/geocode.py   Nominatim search + reverse (throttled, cached)
    services/routing.py   OSRM route → legs + geometry
    services/hos.py       HOS simulation + daily log builder
    views.py, serializers.py, models.py, tests.py
frontend/src/
  App.tsx, api.ts, types.ts, styles.css
  components/TripForm, LocationInput, TripSummary, RouteMap, StopsTimeline, LogSheet
```
