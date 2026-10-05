import type { TripPlan } from "../types";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function TripSummary({ plan }: { plan: TripPlan }) {
  const s = plan.summary;
  const usedPct = Math.min(100, (s.cycle_used_start / 70) * 100);
  const addedPct = Math.min(100 - usedPct, Math.max(0, ((s.cycle_used_end - s.cycle_used_start) / 70) * 100));
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Trip overview</h2>
        <span className="meta">{fmt(s.start)} → {fmt(s.end)}</span>
      </div>
      <div className="summary-grid">
        <div className="cell"><div className="v">{s.total_miles.toLocaleString()}<small>mi</small></div><div className="k">{s.to_pickup_miles} to pickup, {s.to_dropoff_miles} loaded</div></div>
        <div className="cell"><div className="v">{s.driving_hours}<small>h</small></div><div className="k">driving time</div></div>
        <div className="cell"><div className="v">{s.trip_hours}<small>h</small></div><div className="k">door to door</div></div>
        <div className="cell"><div className="v">{s.days}</div><div className="k">log sheet{s.days === 1 ? "" : "s"}</div></div>
        <div className="cell"><div className="v">{s.rest_periods}</div><div className="k">10-hour rests</div></div>
        <div className="cell"><div className="v">{s.fuel_stops}</div><div className="k">fuel stops</div></div>
        <div className="cell"><div className="v">{s.breaks}</div><div className="k">30-min breaks</div></div>
        <div className="cell" style={{ gridColumn: "span 2" }}>
          <div className="v">{s.cycle_used_end}<small>/ 70 h</small></div>
          <div className="k">
            cycle after trip{s.restarts > 0 ? ` — ${s.restarts} × 34-hour restart taken` : ""}
          </div>
          <div className="cycle-bar" aria-hidden>
            <div className="used" style={{ width: `${s.restarts ? 0 : usedPct}%` }} />
            <div className="added" style={{ width: `${s.restarts ? (s.cycle_used_end / 70) * 100 : addedPct}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
