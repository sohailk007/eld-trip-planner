import { useState } from "react";
import LocationInput from "./LocationInput";
import type { TripRequest } from "../types";

interface Props { onSubmit: (req: TripRequest) => void; loading: boolean; }

function localNowRounded(): string {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function TripForm({ onSubmit, loading }: Props) {
  const [current, setCurrent] = useState("Dallas, TX");
  const [pickup, setPickup] = useState("Oklahoma City, OK");
  const [dropoff, setDropoff] = useState("Chicago, IL");
  const [cycle, setCycle] = useState(32);
  const [start, setStart] = useState(localNowRounded());
  const [driver, setDriver] = useState("");
  const [carrier, setCarrier] = useState("");
  const [truck, setTruck] = useState("");

  const canSubmit = current.trim() && pickup.trim() && dropoff.trim() && !loading;

  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({
          current_location: current.trim(),
          pickup_location: pickup.trim(),
          dropoff_location: dropoff.trim(),
          cycle_used_hours: cycle,
          start_time: start,
          driver_name: driver.trim(),
          carrier_name: carrier.trim(),
          truck_number: truck.trim(),
        });
      }}
    >
      <div className="panel-head"><h2>Plan a trip</h2></div>
      <div className="panel-body form">
        <LocationInput id="current" label="Current location" value={current} onChange={setCurrent} placeholder="City, State" />
        <LocationInput id="pickup" label="Pickup location" value={pickup} onChange={setPickup} placeholder="City, State" className="pickup" />
        <LocationInput id="dropoff" label="Drop-off location" value={dropoff} onChange={setDropoff} placeholder="City, State" className="dropoff" />

        <div className="field">
          <label htmlFor="cycle">Cycle hours already used (70 hr / 8 days)</label>
          <div className="range-wrap">
            <input id="cycle" type="range" min={0} max={70} step={0.5} value={cycle} onChange={(e) => setCycle(Number(e.target.value))} />
            <output htmlFor="cycle">{cycle}<small> / 70</small></output>
          </div>
          <p className="hint">{(70 - cycle).toFixed(1)} h left before a 34-hour restart is required.</p>
        </div>

        <div className="field">
          <label htmlFor="start">Trip starts (home-terminal time)</label>
          <input id="start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="driver">Driver</label>
            <input id="driver" value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="Optional" />
          </div>
          <div className="field">
            <label htmlFor="truck">Truck / trailer no.</label>
            <input id="truck" value={truck} onChange={(e) => setTruck(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="carrier">Carrier</label>
          <input id="carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Optional" />
        </div>

        <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
          {loading ? "Routing and building logs…" : "Plan route and logs"}
        </button>
        <p className="hint">Routing by OSRM, places by OpenStreetMap. Long trips take a few seconds while stops are named.</p>
      </div>
    </form>
  );
}
