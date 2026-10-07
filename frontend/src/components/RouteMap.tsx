import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { Stop, TripPlan } from "../types";

function pin(kind: string, text: string) {
  return L.divIcon({ className: "", html: `<div class="pin pin-${kind}">${text}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
}

function Fit({ pts }: { pts: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [32, 32] });
  }, [map, pts]);
  return null;
}

const time = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

const icon: Record<string, string> = { fuel: "F", rest: "Zz", break: "", restart: "34", pretrip: "" };

export default function RouteMap({ plan }: { plan: TripPlan }) {
  const { geometry, waypoints } = plan.route;
  const stops = plan.stops.filter((s: Stop) => !["pickup", "dropoff", "pretrip"].includes(s.kind));
  const wp = waypoints;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Route</h2>
        <span className="meta">{wp.current.short} → {wp.pickup.short} → {wp.dropoff.short}</span>
      </div>
      <div className="map-wrap">
        <MapContainer center={[wp.current.lat, wp.current.lon]} zoom={5} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <Polyline positions={geometry} pathOptions={{ color: "#15325c", weight: 5, opacity: 0.85 }} />
          <Fit pts={geometry} />

          <Marker position={[wp.current.lat, wp.current.lon]} icon={pin("current", "A")}>
            <Popup><div className="popup"><b>Start</b><br />{wp.current.label}</div></Popup>
          </Marker>
          <Marker position={[wp.pickup.lat, wp.pickup.lon]} icon={pin("pickup", "P")}>
            <Popup><div className="popup"><b>Pickup, 1 h loading</b><br />{wp.pickup.label}</div></Popup>
          </Marker>
          <Marker position={[wp.dropoff.lat, wp.dropoff.lon]} icon={pin("dropoff", "D")}>
            <Popup><div className="popup"><b>Drop-off, 1 h unloading</b><br />{wp.dropoff.label}</div></Popup>
          </Marker>

          {stops.map((s, i) => (
            <Marker key={i} position={[s.lat, s.lon]} icon={pin(s.kind, icon[s.kind] ?? "")}>
              <Popup>
                <div className="popup">
                  <b>{s.label}</b><br />
                  {s.location}<br />
                  {time(s.start)} · {s.duration_hours >= 1 ? `${s.duration_hours} h` : `${Math.round(s.duration_hours * 60)} min`} · mile {s.mile.toLocaleString()}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </section>
  );
}