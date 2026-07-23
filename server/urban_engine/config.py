"""
Urban Engine — Typed Configuration.

Strongly typed config model for the processing pipeline.
All values validated server-side.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class NetworkProfile(str, Enum):
    WALK = "walk"
    BICYCLE = "bicycle"
    DRIVE = "drive"
    ALL = "all"
class AnalysisProfile(str, Enum):
    PHYSICAL_VEHICLE = "physical_vehicle"
    PEDESTRIAN = "pedestrian"
    CUSTOM = "custom"

class SnappingPolicy(str, Enum):
    OSM_SHARED_NODE = "osm_shared_node"
    ENDPOINT_PROXIMITY = "endpoint_proximity"
    NONE = "none"


@dataclass
class SourceConfig:
    """Source reference — discriminated by kind."""
    kind: str  # upload, osm_bbox, osm_place, project_layers
    upload_id: str | None = None
    bbox: dict[str, float] | None = None  # {west, south, east, north}
    place_name: str | None = None
    project_id: str | None = None
    roads_layer_id: str | None = None
    buildings_layer_id: str | None = None
    boundary_layer_id: str | None = None


@dataclass
class RoadOptions:
    """Road extraction and topology options."""
    include_private_access: bool = False
    include_construction: bool = False
    include_proposed: bool = False
    include_indoor: bool = False
    infer_geometric_crossings: bool = True
    respect_grade_separation: bool = True
    preserve_parallel_edges: bool = True
    preserve_disconnected_components: bool = True
    preserve_dead_ends: bool = True
    simplify_canonical_geometry: bool = False
    minimum_valid_length_m: float = 0.1
    snapping_policy: SnappingPolicy = SnappingPolicy.OSM_SHARED_NODE
    snap_tolerance_m: float = 3.0
    # Field mapping for non-OSM data
    field_mapping: dict[str, str] | None = None
    # Custom road class mapping
    custom_road_class_mapping: dict[str, str] | None = None


@dataclass
class BuildingOptions:
    """Building extraction options."""
    include_buildings: bool = True
    include_building_parts: bool = True
    minimum_building_area_m2: float = 1.0
    make_valid: bool = True
    road_intersection_buffer_m: float = 0.0
    preserve_overlapping_buildings: bool = True
    field_mapping: dict[str, str] | None = None


@dataclass
class OutputOptions:
    """Output format options."""
    geoparquet: bool = True
    geopackage: bool = True
    graphml: bool = True
    geojson_preview: bool = True
    flatgeobuf: bool = False
    zip_bundle: bool = True


@dataclass
class PerformanceOptions:
    """Performance and safety limits."""
    max_networkx_edges: int = 500_000
    topology_batch_size: int = 50_000
    parser_batch_size: int = 100_000
    memory_warning_threshold_mb: int = 4096
    expensive_graph_metric_threshold: int = 50_000
    deterministic_seed: int = 42


@dataclass
class EngineConfig:
    """Complete engine configuration for a processing run."""
    source: SourceConfig
    clip_to_boundary: bool = True
    processing_halo_m: float = 500.0
    analysis_profile: AnalysisProfile = AnalysisProfile.PHYSICAL_VEHICLE
    profile: NetworkProfile = NetworkProfile.ALL
    roads: RoadOptions = field(default_factory=RoadOptions)

    # Building options
    buildings: BuildingOptions = field(default_factory=BuildingOptions)

    # Output options
    output: OutputOptions = field(default_factory=OutputOptions)

    # Performance options
    performance: PerformanceOptions = field(default_factory=PerformanceOptions)

    # Auto-repair
    auto_repair_enabled: bool = True

    # Analysis CRS override (None = auto-detect UTM)
    analysis_crs: str | None = None

    # Rollback list for undone repairs
    undone_repairs: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a JSON-safe dictionary."""
        import dataclasses
        return dataclasses.asdict(self)

    @staticmethod
    def from_dict(d: dict[str, Any]) -> EngineConfig:
        """Deserialize from a dictionary."""
        source = SourceConfig(**d.get("source", {"kind": "upload"}))
        roads = RoadOptions(**d.get("roads", {}))
        buildings = BuildingOptions(**d.get("buildings", {}))
        output = OutputOptions(**d.get("output", {}))
        performance = PerformanceOptions(**d.get("performance", {}))

        return EngineConfig(
            source=source,
            clip_to_boundary=d.get("clip_to_boundary", True),
            processing_halo_m=d.get("processing_halo_m", 500.0),
            analysis_profile=AnalysisProfile(d.get("analysis_profile", "physical_vehicle")),
            profile=NetworkProfile(d.get("profile", "all")),
            roads=roads,
            buildings=buildings,
            output=output,
            performance=performance,
            auto_repair_enabled=d.get("auto_repair_enabled", True),
            analysis_crs=d.get("analysis_crs"),
            undone_repairs=d.get("undone_repairs", []),
        )
