import type { Stop } from "../types";

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const dur = (h: number) => (h >= 1 ? `${h % 1 === 0 ? h : h.toFixed(1)} h` : `${Math.round(h * 60)} min`);

export default function StopsTimeline({ stops }: { stops: Stop[] }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Stops and rests</h2>
        <span className="meta">{stops.length} duty-status changes</span>
      </div>
      <ol className="timeline">
        {stops.map((s, i) => (
          <li key={i}>
            <div className="when">{time(s.start)}<span>{day(s.start)}</span></div>
            <div className={`dot dot-${s.kind}`} />
            <div className="what">
              <b>{s.label}</b>
              <div>{s.location}{s.mile ? ` · mile ${s.mile.toLocaleString()}` : ""}</div>
            </div>
            <div className="dur">{dur(s.duration_hours)}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
