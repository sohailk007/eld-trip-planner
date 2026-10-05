from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path

urlpatterns = [
    path("", lambda r: JsonResponse({"service": "eld-trip-planner", "status": "ok"})),
    path("admin/", admin.site.urls),
    path("api/", include("trips.urls")),
]
