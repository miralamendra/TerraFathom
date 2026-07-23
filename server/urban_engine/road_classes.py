"""
Road Intelligence Layer.

Internal road classification system. Downstream code NEVER uses raw OSM tags.
Everything goes through RoadClass.
"""

from __future__ import annotations

from enum import Enum


class RoadClass(str, Enum):
    """Internal road classification. All downstream analysis uses these."""

    MOTORWAY = "MOTORWAY"
    HIGHWAY = "HIGHWAY"
    ARTERIAL = "ARTERIAL"
    COLLECTOR = "COLLECTOR"
    LOCAL = "LOCAL"
    SERVICE = "SERVICE"
    PEDESTRIAN = "PEDESTRIAN"
    CYCLEWAY = "CYCLEWAY"
    PATH = "PATH"
    TRACK = "TRACK"
    ALLEY = "ALLEY"
    STEPS = "STEPS"
    UNKNOWN = "UNKNOWN"


# ── OSM tag → internal class ─────────────────────────────────────────────────

OSM_TO_ROAD_CLASS: dict[str, RoadClass] = {
    # Motorways
    "motorway": RoadClass.MOTORWAY,
    "motorway_link": RoadClass.MOTORWAY,
    # Highways (trunk)
    "trunk": RoadClass.HIGHWAY,
    "trunk_link": RoadClass.HIGHWAY,
    # Arterials (primary)
    "primary": RoadClass.ARTERIAL,
    "primary_link": RoadClass.ARTERIAL,
    # Collectors (secondary, tertiary)
    "secondary": RoadClass.COLLECTOR,
    "secondary_link": RoadClass.COLLECTOR,
    "tertiary": RoadClass.COLLECTOR,
    "tertiary_link": RoadClass.COLLECTOR,
    # Local
    "residential": RoadClass.LOCAL,
    "living_street": RoadClass.LOCAL,
    "unclassified": RoadClass.LOCAL,
    # Service
    "service": RoadClass.SERVICE,
    # Pedestrian
    "pedestrian": RoadClass.PEDESTRIAN,
    "footway": RoadClass.PEDESTRIAN,
    "sidewalk": RoadClass.PEDESTRIAN,
    "crossing": RoadClass.PEDESTRIAN,
    # Cycleway
    "cycleway": RoadClass.CYCLEWAY,
    # Path
    "path": RoadClass.PATH,
    "bridleway": RoadClass.PATH,
    # Track
    "track": RoadClass.TRACK,
    # Steps
    "steps": RoadClass.STEPS,
    # Alley
    "alley": RoadClass.ALLEY,
}

# ── Default speed limits by road class (km/h) ────────────────────────────────

DEFAULT_SPEED_KMH: dict[RoadClass, float] = {
    RoadClass.MOTORWAY: 120.0,
    RoadClass.HIGHWAY: 100.0,
    RoadClass.ARTERIAL: 60.0,
    RoadClass.COLLECTOR: 50.0,
    RoadClass.LOCAL: 30.0,
    RoadClass.SERVICE: 20.0,
    RoadClass.PEDESTRIAN: 5.0,
    RoadClass.CYCLEWAY: 15.0,
    RoadClass.PATH: 4.0,
    RoadClass.TRACK: 20.0,
    RoadClass.ALLEY: 15.0,
    RoadClass.STEPS: 3.0,
    RoadClass.UNKNOWN: 30.0,
}

# ── Default lane count by road class ─────────────────────────────────────────

DEFAULT_LANES: dict[RoadClass, int] = {
    RoadClass.MOTORWAY: 3,
    RoadClass.HIGHWAY: 2,
    RoadClass.ARTERIAL: 2,
    RoadClass.COLLECTOR: 2,
    RoadClass.LOCAL: 1,
    RoadClass.SERVICE: 1,
    RoadClass.PEDESTRIAN: 1,
    RoadClass.CYCLEWAY: 1,
    RoadClass.PATH: 1,
    RoadClass.TRACK: 1,
    RoadClass.ALLEY: 1,
    RoadClass.STEPS: 1,
    RoadClass.UNKNOWN: 1,
}


def classify_road(highway_tag: str | None) -> RoadClass:
    """Classify a road from its OSM highway tag."""
    if not highway_tag:
        return RoadClass.UNKNOWN
    return OSM_TO_ROAD_CLASS.get(highway_tag.strip().lower(), RoadClass.UNKNOWN)


def classify_from_mapping(
    field_value: str | None,
    custom_mapping: dict[str, RoadClass] | None = None,
) -> RoadClass:
    """
    Classify from an arbitrary source field using a user-defined mapping.
    Falls back to OSM mapping if no custom mapping provided.
    """
    if not field_value:
        return RoadClass.UNKNOWN
    normalized = field_value.strip().lower()
    if custom_mapping:
        return custom_mapping.get(normalized, RoadClass.UNKNOWN)
    return OSM_TO_ROAD_CLASS.get(normalized, RoadClass.UNKNOWN)


def get_default_speed(road_class: RoadClass) -> float:
    """Get default speed in km/h for a road class."""
    return DEFAULT_SPEED_KMH.get(road_class, 30.0)


def get_default_lanes(road_class: RoadClass) -> int:
    """Get default lane count for a road class."""
    return DEFAULT_LANES.get(road_class, 1)
