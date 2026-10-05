from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health),
    path("geocode/", views.geocode_view),
    path("trips/plan/", views.plan_trip),
    path("trips/", views.list_trips),
    path("trips/<int:pk>/", views.get_trip),
]
