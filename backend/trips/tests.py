from datetime import datetime
from unittest.mock import patch

from django.test import SimpleTestCase

from .services import hos


class HosPlannerTests(SimpleTestCase):
    def _plan(self, legs, cycle_used=0, start=datetime(2026, 10, 6, 8, 0)):
        geometry = [[34.0 + i * 0.05, -118.0 + i * 0.2] for i in range(50)]
        wp = {"current": {"short": "A"}, "pickup": {"short": "B"}, "dropoff": {"short": "C"}}
        with patch.object(hos, "reverse", lambda la, lo: "X"):
            return hos.plan_hos(legs, geometry, start, cycle_used, wp, {})

    def test_each_log_day_totals_24_hours(self):
        out = self._plan([{"distance_miles": 300, "duration_hours": 5}, {"distance_miles": 2200, "duration_hours": 36}], 20)
        for log in out["logs"]:
            self.assertAlmostEqual(sum(log["totals"].values()), 24.0, places=1)

    def test_never_more_than_11_driving_hours_between_rests(self):
        out = self._plan([{"distance_miles": 100, "duration_hours": 2}, {"distance_miles": 2500, "duration_hours": 40}], 0)
        acc = 0.0
        for s in out["segments"]:
            if s["status"] == "driving":
                acc += s["hours"]
                self.assertLessEqual(acc, 11.0 + 1e-6)
            elif s["kind"] in ("rest", "restart"):
                acc = 0.0

    def test_fuel_stop_every_1000_miles(self):
        out = self._plan([{"distance_miles": 100, "duration_hours": 2}, {"distance_miles": 2100, "duration_hours": 35}], 0)
        self.assertEqual(out["summary"]["fuel_stops"], 2)

    def test_restart_when_cycle_exhausted(self):
        out = self._plan([{"distance_miles": 50, "duration_hours": 1}, {"distance_miles": 600, "duration_hours": 10}], 68)
        self.assertEqual(out["summary"]["restarts"], 1)

    def test_pickup_and_dropoff_one_hour_each(self):
        out = self._plan([{"distance_miles": 50, "duration_hours": 1}, {"distance_miles": 200, "duration_hours": 4}], 0)
        kinds = {s["kind"]: s["duration_hours"] for s in out["stops"]}
        self.assertEqual(kinds["pickup"], 1.0)
        self.assertEqual(kinds["dropoff"], 1.0)
