from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Trip
from .serializers import TripRequestSerializer, TripSerializer
from .services.geocode import GeocodeError, geocode, search
from .services.routing import RoutingError, route
from .services.hos import plan_hos


@api_view(["GET"])
def health(request):
    return Response({"status": "ok", "time": timezone.now()})


@api_view(["GET"])
def geocode_view(request):
    q = request.GET.get("q", "").strip()
    if len(q) < 3:
        return Response([])
    try:
        return Response(search(q))
    except GeocodeError as e:
        return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(["POST"])
def plan_trip(request):
    ser = TripRequestSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    d = ser.validated_data
    start = d.get("start_time") or timezone.now()

    try:
        cur = geocode(d["current_location"])
        pick = geocode(d["pickup_location"])
        drop = geocode(d["dropoff_location"])
    except GeocodeError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    try:
        r = route([cur, pick, drop])
    except RoutingError as e:
        return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

    plan = plan_hos(
        legs=r["legs"],
        geometry=r["geometry"],
        start_time=start,
        cycle_used_hours=d["cycle_used_hours"],
        waypoints={"current": cur, "pickup": pick, "dropoff": drop},
        header={
            "driver_name": d.get("driver_name", ""),
            "carrier_name": d.get("carrier_name", ""),
            "truck_number": d.get("truck_number", ""),
        },
    )

    trip = Trip.objects.create(
        current_location=d["current_location"],
        pickup_location=d["pickup_location"],
        dropoff_location=d["dropoff_location"],
        cycle_used_hours=d["cycle_used_hours"],
        start_time=start,
        total_miles=r["distance_miles"],
        total_days=len(plan["logs"]),
        result=plan,
    )
    return Response({"id": trip.id, **plan})


@api_view(["GET"])
def list_trips(request):
    qs = Trip.objects.order_by("-created_at")[:20]
    return Response(TripSerializer(qs, many=True).data)


@api_view(["GET"])
def get_trip(request, pk):
    try:
        trip = Trip.objects.get(pk=pk)
    except Trip.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)
    return Response({"id": trip.id, **trip.result})
