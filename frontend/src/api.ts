import type { TripPlan, TripRequest } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = body.detail ?? Object.values(body).flat().join(" ") ?? msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

export async function planTrip(req: TripRequest): Promise<TripPlan> {
  const res = await fetch(`${BASE}/api/trips/plan/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handle<TripPlan>(res);
}

export async function geocodeSuggest(q: string): Promise<{ label: string; short: string }[]> {
  const res = await fetch(`${BASE}/api/geocode/?q=${encodeURIComponent(q)}`);
  return handle(res);
}
