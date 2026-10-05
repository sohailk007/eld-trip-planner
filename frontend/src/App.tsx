import { useState } from "react";
import { planTrip } from "./api";
import LogSheet from "./components/LogSheet";
import RouteMap from "./components/RouteMap";
import StopsTimeline from "./components/StopsTimeline";
import TripForm from "./components/TripForm";
import TripSummary from "./components/TripSummary";
import type { TripPlan, TripRequest } from "./types";

export default function App() {
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (req: TripRequest) => {
    setLoading(true);
    setError(null);
    try {
      setPlan(await planTrip(req));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while planning the trip.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="topbar">
        <h1>Roadbook</h1>
        <p className="tagline">Route a load, get every stop, rest and fuel planned to FMCSA hours of service — with the daily logs already filled in.</p>
      </header>

      <div className="shell">
        <aside className="sidebar">
          <TripForm onSubmit={submit} loading={loading} />
          {error && <p className="error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
        </aside>

        <main className="main">
          {!plan && !loading && (
            <section className="panel empty">
              <h2>Enter a trip to begin</h2>
              <p>You'll get the route on a map, a timeline of pickup, fuel, break and rest stops, and one filled-in Driver's Daily Log per day.</p>
            </section>
          )}
          {loading && !plan && (
            <section className="panel empty" aria-busy>
              <h2>Planning your trip…</h2>
              <p>Finding the route, then simulating the 11-hour, 14-hour, 30-minute and 70-hour rules mile by mile.</p>
            </section>
          )}
          {plan && (
            <>
              <TripSummary plan={plan} />
              <RouteMap plan={plan} />
              <StopsTimeline stops={plan.stops} />

              <section className="logs">
                <div className="panel-head" style={{ border: 0, padding: "0 2px" }}>
                  <h2>Daily log sheets</h2>
                  <div className="log-toolbar no-print">
                    <button className="btn btn-ghost" type="button" onClick={() => window.print()}>Print or save as PDF</button>
                  </div>
                </div>
                {plan.logs.map((log) => (
                  <article className="sheet" key={log.date}>
                    <LogSheet log={log} />
                    <div className="legend no-print">
                      <span className="l-off">Off duty</span>
                      <span className="l-sb">Sleeper berth</span>
                      <span className="l-dr">Driving</span>
                      <span className="l-on">On duty, not driving</span>
                      <span style={{ marginLeft: "auto" }}>
                        {new Date(log.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  </article>
                ))}
              </section>

              <section className="panel no-print">
                <div className="panel-head"><h3>How these logs were calculated</h3></div>
                <div className="panel-body">
                  <ul className="assumptions">
                    {plan.assumptions.map((a) => <li key={a}>{a}</li>)}
                  </ul>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
}
