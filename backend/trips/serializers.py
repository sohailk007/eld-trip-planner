from rest_framework import serializers
from .models import Trip


class TripRequestSerializer(serializers.Serializer):
    current_location = serializers.CharField(max_length=255)
    pickup_location = serializers.CharField(max_length=255)
    dropoff_location = serializers.CharField(max_length=255)
    cycle_used_hours = serializers.FloatField(min_value=0, max_value=70)
    start_time = serializers.DateTimeField(required=False)
    driver_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    carrier_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    truck_number = serializers.CharField(max_length=60, required=False, allow_blank=True)


class TripSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = "__all__"
