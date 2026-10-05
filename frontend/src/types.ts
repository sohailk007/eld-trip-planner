export type Status = "off_duty" | "sleeper" | "driving" | "on_duty";
export type StopKind = "pretrip" | "drive" | "break" | "fuel" | "rest" | "restart" | "pickup" | "dropoff" | "end";

export interface Waypoint { query: string; label: string; short: string; lat: number; lon: number; }

export interface Stop {
  kind: StopKind; label: string; location: string; lat: number; lon: number;
  start: string; end: string; duration_hours: number; mile: number; status: Status;
}

export interface LogSegment {
  status: Status; start_hour: number; end_hour: number; label: string; kind?: StopKind; location: string; miles?: number;
}

export interface DailyLog {
  day_index: number; date: string; from: string; to: string; total_miles: number;
  segments: LogSegment[];
  totals: Record<Status, number>;
  remarks: { hour: number; text: string }[];
  header: { driver_name?: string; carrier_name?: string; truck_number?: string };
  cycle_used_end: number;
  cycle_available_tomorrow: number;
}

export interface TripPlan {
  id?: number;
  summary: {
    total_miles: number; to_pickup_miles: number; to_dropoff_miles: number;
    driving_hours: number; on_duty_hours: number; trip_hours: number;
    start: string; end: string; days: number;
    fuel_stops: number; rest_periods: number; breaks: number; restarts: number;
    cycle_used_start: number; cycle_used_end: number;
  };
  route: { geometry: [number, number][]; waypoints: { current: Waypoint; pickup: Waypoint; dropoff: Waypoint }; pickup_mile: number };
  stops: Stop[];
  logs: DailyLog[];
  assumptions: string[];
}

export interface TripRequest {
  current_location: string; pickup_location: string; dropoff_location: string;
  cycle_used_hours: number; start_time: string;
  driver_name?: string; carrier_name?: string; truck_number?: string;
}
