from django.db import models


class Trip(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    cycle_used_hours = models.FloatField()
    start_time = models.DateTimeField()
    total_miles = models.FloatField(default=0)
    total_days = models.IntegerField(default=0)
    result = models.JSONField(default=dict)

    def __str__(self):
        return f"{self.current_location} -> {self.pickup_location} -> {self.dropoff_location}"
