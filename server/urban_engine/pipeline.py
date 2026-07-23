"""
Urban Engine Pipeline — Phase Orchestrator.

Runs the 21-phase pipeline sequentially, updating progress and
checking cancellation between phases.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import time
from typing import Any

from config import settings
from storage import JobStatus, JobUpdate, StorageInterface
from storage.filesystem_adapter import FilesystemAdapter
from urban_engine.config import EngineConfig
from urban_engine.exceptions import JobCancelledError
from urban_engine.metadata import RunMetadata

logger = logging.getLogger("urban_engine.pipeline")


# ── Phase definitions ─────────────────────────────────────────────────────────

PHASES = [
    "VALIDATE_INPUT",
    "ACQUIRE_SOURCE",
    "STAGE_SOURCE",
    "RESOLVE_BOUNDARY",
    "SELECT_ANALYSIS_CRS",
    "EXTRACT_AND_CLASSIFY_ROADS",
    "CLEAN_ROAD_GEOMETRY",
    "BUILD_TOPOLOGY",
    "NETWORK_SEMANTICS",
    "CORRIDOR_INFERENCE",
    "JUNCTION_GENERALIZATION",
    "VALIDATE_NETWORK",
    "REPAIR_NETWORK",
    "CONNECTIVITY_VERIFICATION",
    "COMPUTE_DERIVED_ATTRIBUTES",
    "BUILD_GRAPHS",
    "EXTRACT_BUILDINGS",
    "CALCULATE_STATISTICS",
    "CALCULATE_CONFIDENCE",
    "RUN_QUALITY_CHECKS",
    "GENERATE_WEB_PREVIEW",
    "EXPORT",
    "SAVE_METADATA",
    "COMMIT_ARTIFACTS",
    "COMPLETE",
]

# Weight per phase for progress calculation (sums to 100)
PHASE_WEIGHTS: dict[str, float] = {
    "VALIDATE_INPUT": 2,
    "ACQUIRE_SOURCE": 4,
    "STAGE_SOURCE": 2,
    "RESOLVE_BOUNDARY": 2,
    "SELECT_ANALYSIS_CRS": 1,
    "EXTRACT_AND_CLASSIFY_ROADS": 10,
    "CLEAN_ROAD_GEOMETRY": 5,
    "BUILD_TOPOLOGY": 10,
    "NETWORK_SEMANTICS": 8,
    "CORRIDOR_INFERENCE": 15,
    "VALIDATE_NETWORK": 8,
    "REPAIR_NETWORK": 6,
    "CONNECTIVITY_VERIFICATION": 4,
    "COMPUTE_DERIVED_ATTRIBUTES": 4,
    "BUILD_GRAPHS": 6,
    "EXTRACT_BUILDINGS": 3,
    "CALCULATE_STATISTICS": 4,
    "CALCULATE_CONFIDENCE": 2,
    "RUN_QUALITY_CHECKS": 1,
    "GENERATE_WEB_PREVIEW": 1,
    "EXPORT": 1,
    "SAVE_METADATA": 1,
    "COMMIT_ARTIFACTS": 1,
    "COMPLETE": 1,
}


class PipelineContext:
    """Shared context passed through pipeline phases."""

    def __init__(
        self,
        job_id: str,
        storage: StorageInterface,
        filesystem: FilesystemAdapter,
        config: EngineConfig,
    ) -> None:
        self.job_id = job_id
        self.storage = storage
        self.filesystem = filesystem
        self.config = config
        self.metadata = RunMetadata()
        self.phase_timings: dict[str, float] = {}
        self.warnings: list[dict[str, Any]] = []

        # Intermediate state — set by phases
        self.source_path: str | None = None
        self.source_format: str | None = None
        self.source_crs: str | None = None
        self.analysis_crs: str | None = None
        self.boundary_geom: Any = None
        self.boundary_area_km2: float = 0.0

        # Versioned Snaps (v0 to v5)
        self.v0_raw: Any = None
        self.v1_clean: Any = None
        self.v2_topology: Any = None
        self.v3_corridors: Any = None

        # Data frames — populated by processing phases
        self.raw_roads: Any = None
        self.road_segments: Any = None
        self.road_nodes: Any = None
        self.buildings: Any = None

        # Audit logs and mappings
        self.modifications_log: list[Any] = []
        self.roundabout_mappings: dict[str, str] = {}
        self.connectivity_report: dict[str, Any] = {}

        # Validation/repair results
        self.validation_issues: list[dict[str, Any]] = []
        self.repair_results: dict[str, Any] = {
            "detected": 0,
            "auto_fixed": 0,
            "manual_review": 0,
        }

        # Graphs
        self.graphs: dict[str, Any] = {}

        # Statistics & quality
        self.statistics: dict[str, Any] = {}
        self.quality_report: dict[str, Any] = {}
        self.confidence: dict[str, float] = {}

    def check_cancelled(self) -> None:
        """Check if cancellation has been requested. Raises if so."""
        job = self.storage.get_job(self.job_id)
        if job and job.cancellation_requested:
            raise JobCancelledError("Job was cancelled by user.")

    def update_progress(self, phase: str, pct: float, detail: dict[str, Any] | None = None) -> None:
        """Update job progress. Progress is monotonic."""
        self.storage.update_progress(self.job_id, phase, pct, detail)


def _compute_progress(phase_index: int, intra_phase_pct: float = 100.0) -> float:
    """Compute overall progress percentage from phase index."""
    completed_weight = sum(
        PHASE_WEIGHTS.get(PHASES[i], 1) for i in range(phase_index)
    )
    current_weight = PHASE_WEIGHTS.get(PHASES[phase_index], 1) if phase_index < len(PHASES) else 0
    total_weight = sum(PHASE_WEIGHTS.values())

    pct = (completed_weight + current_weight * (intra_phase_pct / 100.0)) / total_weight * 100
    return min(100.0, round(pct, 1))


# ── Phase Handlers ────────────────────────────────────────────────────────────

def phase_validate_input(ctx: PipelineContext) -> None:
    from urban_engine.import_.upload_validation import validate_file_size, validate_extension
    if ctx.config.source.kind == "upload":
        upload_id = ctx.config.source.upload_id
        if not upload_id:
            raise ValueError("Upload ID missing in upload source config.")
        
        # Find upload file in filesystem
        upload_dir = ctx.filesystem.upload_dir(upload_id)
        files = list(upload_dir.glob("*"))
        if not files:
            raise ValueError(f"No upload files found under upload ID: {upload_id}")
        
        ctx.source_path = files[0]
        validate_file_size(ctx.source_path)
        validate_extension(ctx.source_path.name)


def phase_acquire_source(ctx: PipelineContext) -> None:
    from urban_engine.import_.remote_osm import fetch_osm_by_bbox, geocode_place
    if ctx.config.source.kind == "osm_bbox":
        bbox = ctx.config.source.bbox
        if not bbox:
            raise ValueError("Bounding box missing in OSM source config.")
        include_bld = ctx.config.buildings.include_buildings if ctx.config.buildings else True
        ctx.source_path = fetch_osm_by_bbox(bbox, include_buildings=include_bld)
        ctx.source_format = "osm_xml"
    elif ctx.config.source.kind == "osm_place":
        place_name = ctx.config.source.place_name
        if not place_name:
            raise ValueError("Place name missing in OSM place source config.")
        bbox = geocode_place(place_name)
        include_bld = ctx.config.buildings.include_buildings if ctx.config.buildings else True
        ctx.source_path = fetch_osm_by_bbox(bbox, include_buildings=include_bld)
        ctx.source_format = "osm_xml"
    elif ctx.config.source.kind == "upload":
        ctx.source_format = ctx.source_path.suffix.lstrip(".").lower()
    else:
        raise ValueError(f"Unsupported source kind: {ctx.config.source.kind}")


def phase_stage_source(ctx: PipelineContext) -> None:
    # Set metadata sources
    ctx.metadata.dataset_name = ctx.source_path.name
    ctx.metadata.source_kind = ctx.config.source.kind
    ctx.metadata.source_reference = json.dumps(ctx.config.source, default=str)


def phase_resolve_boundary(ctx: PipelineContext) -> None:
    from urban_engine.cleaning.boundary import resolve_boundary_geometry
    bbox = ctx.config.source.bbox if ctx.config.source.kind in ("osm_bbox", "osm_place") else None
    boundary_geom, area = resolve_boundary_geometry(config_bbox=bbox)
    ctx.boundary_geom = boundary_geom
    ctx.boundary_area_km2 = area
    ctx.metadata.boundary_area_km2 = round(area, 2)


def phase_select_analysis_crs(ctx: PipelineContext) -> None:
    from urban_engine.import_.crs import suggest_utm_crs
    if ctx.config.analysis_crs:
        from pyproj import CRS
        ctx.analysis_crs = CRS(ctx.config.analysis_crs)
    else:
        # Determine from boundary centroid
        minx, miny, maxx, maxy = ctx.boundary_geom.bounds
        ctx.analysis_crs = suggest_utm_crs((minx, miny, maxx, maxy))
    ctx.metadata.analysis_crs = ctx.analysis_crs.to_string()


def phase_extract_and_classify_roads(ctx: PipelineContext) -> None:
    from urban_engine.import_.osm_parser import parse_osm_file
    from urban_engine.import_.vector_loader import load_vector_file
    from urban_engine.import_.crs import project_to_crs
    from urban_engine.road_classes import classify_road

    node_coords = {}

    if ctx.source_format in ("osm_pbf", "osm_xml", "osm_bz2") or ctx.config.source.kind in ("osm_bbox", "osm_place"):
        # OSM Ingestion
        roads_gdf, buildings_gdf, node_coords = parse_osm_file(
            ctx.source_path,
            include_buildings=ctx.config.buildings.include_buildings,
        )
        ctx.raw_roads = project_to_crs(roads_gdf, ctx.analysis_crs)
        if not buildings_gdf.empty:
            ctx.buildings = project_to_crs(buildings_gdf, ctx.analysis_crs)
    else:
        # Generic Vector Ingestion
        gdf = load_vector_file(
            ctx.source_path,
            field_mapping=ctx.config.roads.field_mapping,
        )
        ctx.raw_roads = project_to_crs(gdf, ctx.analysis_crs)

    # Project node_coords to ctx.analysis_crs
    ctx.projected_osm_nodes = {}
    if node_coords:
        from pyproj import Transformer
        transformer = Transformer.from_crs("EPSG:4326", ctx.analysis_crs, always_xy=True)
        for node_id, (lon, lat) in node_coords.items():
            x, y = transformer.transform(lon, lat)
            ctx.projected_osm_nodes[node_id] = (x, y)

    if ctx.raw_roads.empty:
        from urban_engine.exceptions import EmptyRoadLayerError
        raise EmptyRoadLayerError("No roads found in the ingested data. Please check your boundary/file.")

    ctx.raw_roads["road_class"] = ctx.raw_roads.apply(
        lambda r: classify_road(r.get("highway")), axis=1
    )
    # Version 0: Raw Ingestion Snap
    ctx.v0_raw = ctx.raw_roads.copy()


def phase_clean_road_geometry(ctx: PipelineContext) -> None:
    from urban_engine.cleaning.normalizer import normalize_road_network
    normalized_gdf, mods = normalize_road_network(
        ctx.raw_roads,
        min_length_m=ctx.config.roads.minimum_valid_length_m,
    )
    ctx.road_segments = normalized_gdf
    ctx.modifications_log.extend(mods)
    
    # Version 1: Clean Snap
    ctx.v1_clean = ctx.road_segments.copy()


def phase_build_topology(ctx: PipelineContext) -> None:
    from urban_engine.cleaning.crossing_resolver import resolve_crossings
    from urban_engine.topology.shared_node import build_topology
    
    # 1. Split lines at intersections if enabled using grade-separation-aware crossing resolver
    if ctx.config.roads.infer_geometric_crossings:
        split_gdf, crossing_mods = resolve_crossings(
            ctx.road_segments,
            snap_tolerance_m=ctx.config.roads.snap_tolerance_m,
        )
        ctx.road_segments = split_gdf
        ctx.modifications_log.extend(crossing_mods)

    # 2. Build physical node-segment linkages passing OSM nodes
    projected_nodes = getattr(ctx, "projected_osm_nodes", None)
    nodes_gdf, segments_gdf = build_topology(
        ctx.road_segments,
        snap_tolerance_m=ctx.config.roads.snap_tolerance_m,
        projected_osm_nodes=projected_nodes,
    )
    ctx.road_nodes = nodes_gdf
    ctx.road_segments = segments_gdf
    # Version 2: Topology Snap
    ctx.v2_topology = ctx.road_segments.copy()


def phase_network_semantics(ctx: PipelineContext) -> None:
    from urban_engine.semantics.semantics_engine import SemanticsEngine
    engine = SemanticsEngine(ctx.road_segments, ctx.road_nodes, config=ctx.config)
    roads, nodes = engine.process()
    ctx.road_segments = roads
    ctx.road_nodes = nodes


def phase_corridor_inference(ctx: PipelineContext) -> None:
    from urban_engine.cleaning.corridor_inference import CorridorInferenceEngine
    engine = CorridorInferenceEngine(
        ctx.road_segments,
        ctx.road_nodes,
        undone_repairs=ctx.config.undone_repairs,
        snap_tolerance_m=ctx.config.roads.snap_tolerance_m,
        projected_osm_nodes=getattr(ctx, "projected_osm_nodes", None),
    )
    roads, nodes, mods, roundabouts = engine.process()
    ctx.road_segments = roads
    ctx.road_nodes = nodes
    ctx.modifications_log.extend(mods)
    ctx.roundabout_mappings = roundabouts
    # Version 3: Corridors Snap
    ctx.v3_corridors = ctx.road_segments.copy()


def phase_junction_generalization(ctx: PipelineContext) -> None:
    from urban_engine.cleaning.junction_generalizer import JunctionGeneralizer
    engine = JunctionGeneralizer(
        ctx.road_segments,
        ctx.road_nodes,
        undone_repairs=ctx.config.undone_repairs,
    )
    roads, nodes, mods = engine.process()
    ctx.road_segments = roads
    ctx.road_nodes = nodes
    ctx.modifications_log.extend(mods)


def phase_validate_network(ctx: PipelineContext) -> None:
    from urban_engine.validation.validator import NetworkValidator
    validator = NetworkValidator(ctx.road_segments)
    issues = validator.validate_all(ctx.config.roads.snap_tolerance_m)
    ctx.validation_issues = [
        {
            "code": i.code,
            "severity": i.severity,
            "message": i.message,
            "feature_ids": i.feature_ids,
            "auto_fixable": i.auto_fixable,
        } for i in issues
    ]


def phase_repair_network(ctx: PipelineContext) -> None:
    from urban_engine.cleaning.auto_repair import repair_network
    
    # Initialize manual_review column as 0
    ctx.road_segments["manual_review"] = 0
    
    # Mark segments that require manual review (those that are not auto_fixable)
    for issue in ctx.validation_issues:
        if not issue.get("auto_fixable", False):
            for f_id in issue.get("feature_ids", []):
                try:
                    if f_id in ctx.road_segments.index:
                        ctx.road_segments.at[f_id, "manual_review"] = 1
                except Exception:
                    pass

    if ctx.config.auto_repair_enabled:
        repaired, counts = repair_network(
            ctx.road_segments,
            snap_tolerance_m=ctx.config.roads.snap_tolerance_m,
        )
        ctx.road_segments = repaired
        ctx.repair_results = counts
    else:
        ctx.repair_results = {"detected": len(ctx.validation_issues), "auto_fixed": 0, "manual_review": len(ctx.validation_issues)}


def phase_connectivity_verification(ctx: PipelineContext) -> None:
    from urban_engine.validation.connectivity import ConnectivityVerifier
    verifier = ConnectivityVerifier(ctx.road_segments, ctx.road_nodes)
    ctx.connectivity_report = verifier.verify()


def phase_compute_derived_attributes(ctx: PipelineContext) -> None:
    from urban_engine.graph.derived_attributes import compute_edge_attributes
    ctx.road_segments = compute_edge_attributes(ctx.road_segments, ctx.road_nodes)


def phase_build_graphs(ctx: PipelineContext) -> None:
    from urban_engine.graph.graph_builder import GraphBuilder
    builder = GraphBuilder(ctx.road_segments, ctx.road_nodes)
    
    physical = builder.build_physical_graph()
    directed = builder.build_directed_graph()
    pedestrian = builder.build_pedestrian_graph(directed)
    vehicle = builder.build_vehicle_graph(directed)

    ctx.graphs = {
        "physical": physical,
        "directed": directed,
        "pedestrian": pedestrian,
        "vehicle": vehicle,
    }




def phase_extract_buildings(ctx: PipelineContext) -> None:
    from urban_engine.buildings.extractor import extract_and_enrich_buildings
    if ctx.config.buildings.include_buildings and ctx.buildings is not None:
        ctx.buildings = extract_and_enrich_buildings(
            ctx.buildings,
            ctx.road_segments,
            min_area_m2=ctx.config.buildings.minimum_building_area_m2,
        )


def phase_calculate_statistics(ctx: PipelineContext) -> None:
    from urban_engine.statistics.collector import collect_all_statistics
    ctx.statistics = collect_all_statistics(ctx, ctx.graphs)


def phase_calculate_confidence(ctx: PipelineContext) -> None:
    from urban_engine.quality.confidence import calculate_confidence_scores
    ctx.confidence = calculate_confidence_scores(
        ctx.road_segments,
        ctx.road_nodes,
        ctx.graphs["physical"],
        ctx.repair_results,
        connectivity_report=ctx.connectivity_report,
    )


def phase_run_quality_checks(ctx: PipelineContext) -> None:
    from urban_engine.quality.qa_report import generate_qa_report
    # Generate structured QA report
    qa_report = generate_qa_report(ctx)

    # Add validation issues to warnings
    for issue in ctx.validation_issues:
        ctx.warnings.append({
            "code": issue["code"],
            "severity": issue["severity"],
            "message": issue["message"],
            "feature_ids": issue["feature_ids"],
            "auto_fixable": issue["auto_fixable"],
        })

    # Set warnings based on confidence metrics
    if ctx.confidence.get("overall", 100.0) < 80.0:
        ctx.warnings.append({
            "code": "low_confidence",
            "severity": "warning",
            "message": f"Overall confidence score is low ({ctx.confidence.get('overall')}%) due to geometry/topology issues.",
            "feature_ids": [],
            "auto_fixable": False,
        })
    
    qa_report["warnings"] = ctx.warnings
    ctx.quality_report = qa_report


def phase_generate_web_preview(ctx: PipelineContext) -> None:
    # Web preview outputs will be created during export phase to GeoJSON
    pass


def phase_export(ctx: PipelineContext) -> None:
    from urban_engine.export.exporter import export_all_outputs
    staging_dir = ctx.filesystem.staging_dir(ctx.job_id)
    ctx.exported_paths = export_all_outputs(
        ctx,
        staging_dir,
    )


def phase_save_metadata(ctx: PipelineContext) -> None:
    # Finalise run metadata
    import hashlib
    ctx.metadata.road_count = len(ctx.raw_roads) if ctx.raw_roads is not None else 0
    ctx.metadata.raw_road_count = ctx.metadata.road_count
    ctx.metadata.segment_count = len(ctx.road_segments) if ctx.road_segments is not None else 0
    ctx.metadata.node_count = len(ctx.road_nodes) if ctx.road_nodes is not None else 0
    ctx.metadata.building_count = len(ctx.buildings) if ctx.buildings is not None else 0
    ctx.metadata.component_count = ctx.statistics.get("connectivity", {}).get("connected_components_count", 1)

    # Save to staging
    metadata_json = ctx.metadata.to_json()
    metadata_path = ctx.filesystem.staging_dir(ctx.job_id) / "metadata.json"
    metadata_path.write_bytes(metadata_json)
    
    # Store checksums
    ctx.metadata.result_checksum = hashlib.sha256(metadata_json).hexdigest()[:16]


def phase_commit_artifacts(ctx: PipelineContext) -> None:
    # Commit files from staging to job outputs
    ctx.filesystem.commit_staging(ctx.job_id)

    # Register each exported artifact in db
    import uuid
    from storage import ArtifactCreate, ArtifactType

    # Map from exported filename -> ArtifactType
    FILENAME_TYPE_MAP = {
        "roads.parquet": ArtifactType.ROAD_SEGMENTS,
        "nodes.parquet": ArtifactType.ROAD_NODES,
        "buildings.parquet": ArtifactType.BUILDINGS,
        "urban_network.gpkg": ArtifactType.GEOPACKAGE,
        "raw_roads.geojson": ArtifactType.GEOPACKAGE,
        "clean_roads.geojson": ArtifactType.ROAD_SEGMENTS,
        "v2_topology.geojson": ArtifactType.PREVIEW_SEGMENTS,
        "corridors.geojson": ArtifactType.PREVIEW_SEGMENTS,
        "preview_segments.geojson": ArtifactType.PREVIEW_SEGMENTS,
        "validation.geojson": ArtifactType.QUALITY_REPORT,
        "repair_points.geojson": ArtifactType.QUALITY_REPORT,
        "junctions.geojson": ArtifactType.PREVIEW_NODES,
        "modifications_report.json": ArtifactType.QUALITY_REPORT,
        "modifications_report.md": ArtifactType.QUALITY_REPORT,
        "qa_report.json": ArtifactType.QUALITY_REPORT,
        "qa_report.md": ArtifactType.QUALITY_REPORT,
    }

    job_dir = ctx.filesystem.job_dir(ctx.job_id)
    for key, staging_path in ctx.exported_paths.items():
        filename = staging_path.name
        rel_key = f"jobs/{ctx.job_id}/{filename}"

        # Determine artifact type from filename (reliable) instead of key string
        art_type = FILENAME_TYPE_MAP.get(filename)
        if art_type is None:
            # Fallback: GraphML files
            if filename.endswith(".graphml"):
                art_type = ArtifactType.PHYSICAL_GRAPH
            else:
                art_type = ArtifactType.GEOPACKAGE

        # Use committed file path for size_bytes (staging is already moved)
        committed_path = job_dir / filename
        size_bytes = committed_path.stat().st_size if committed_path.exists() else 0

        art_create = ArtifactCreate(
            id=str(uuid.uuid4()),
            job_id=ctx.job_id,
            artifact_type=art_type,
            storage_key=rel_key,
            format=staging_path.suffix.lstrip(".").lower(),
            crs=ctx.metadata.analysis_crs,
            size_bytes=size_bytes,
            checksum=None,
        )
        ctx.storage.register_artifact(art_create)


def phase_complete(ctx: PipelineContext) -> None:
    pass


PHASE_HANDLERS = {
    "VALIDATE_INPUT": phase_validate_input,
    "ACQUIRE_SOURCE": phase_acquire_source,
    "STAGE_SOURCE": phase_stage_source,
    "RESOLVE_BOUNDARY": phase_resolve_boundary,
    "SELECT_ANALYSIS_CRS": phase_select_analysis_crs,
    "EXTRACT_AND_CLASSIFY_ROADS": phase_extract_and_classify_roads,
    "CLEAN_ROAD_GEOMETRY": phase_clean_road_geometry,
    "BUILD_TOPOLOGY": phase_build_topology,
    "NETWORK_SEMANTICS": phase_network_semantics,
    "CORRIDOR_INFERENCE": phase_corridor_inference,
    "JUNCTION_GENERALIZATION": phase_junction_generalization,
    "VALIDATE_NETWORK": phase_validate_network,
    "REPAIR_NETWORK": phase_repair_network,
    "CONNECTIVITY_VERIFICATION": phase_connectivity_verification,
    "COMPUTE_DERIVED_ATTRIBUTES": phase_compute_derived_attributes,
    "BUILD_GRAPHS": phase_build_graphs,
    "EXTRACT_BUILDINGS": phase_extract_buildings,
    "CALCULATE_STATISTICS": phase_calculate_statistics,
    "CALCULATE_CONFIDENCE": phase_calculate_confidence,
    "RUN_QUALITY_CHECKS": phase_run_quality_checks,
    "GENERATE_WEB_PREVIEW": phase_generate_web_preview,
    "EXPORT": phase_export,
    "SAVE_METADATA": phase_save_metadata,
    "COMMIT_ARTIFACTS": phase_commit_artifacts,
    "COMPLETE": phase_complete,
}


def run_pipeline(
    job_id: str,
    storage: StorageInterface,
    filesystem: FilesystemAdapter,
) -> None:
    """Run the complete Urban Engine pipeline for a job."""

    # Load job and config
    job = storage.get_job(job_id)
    if not job:
        raise ValueError(f"Job {job_id} not found")

    config = EngineConfig.from_dict(json.loads(job.config_json)) if job.config_json != "{}" else EngineConfig()

    # Parse source from job's source_reference
    source_ref = json.loads(job.source_reference)
    from urban_engine.config import SourceConfig
    config.source = SourceConfig(
        kind=source_ref.get("kind", "upload"),
        upload_id=source_ref.get("upload_id"),
        bbox=source_ref.get("bbox"),
        place_name=source_ref.get("place_name"),
    )

    ctx = PipelineContext(
        job_id=job_id,
        storage=storage,
        filesystem=filesystem,
        config=config,
    )

    ctx.metadata.software_version = settings.app_version
    ctx.metadata.engine_version = settings.engine_version
    ctx.metadata.pipeline_version = settings.pipeline_version
    ctx.metadata.populate_library_versions()
    ctx.metadata.import_date = dt.datetime.now(dt.timezone.utc).isoformat()

    pipeline_start = time.time()

    try:
        for i, phase in enumerate(PHASES):
            # Check cancellation before each phase
            ctx.check_cancelled()

            phase_start = time.time()
            progress = _compute_progress(i)
            ctx.update_progress(phase, progress)

            logger.info("Job %s: phase %s (%.1f%%)", job_id, phase, progress)

            # Execute phase
            handler = PHASE_HANDLERS.get(phase)
            if handler:
                handler(ctx)
            else:
                logger.warning("No handler found for phase: %s", phase)

            phase_elapsed = time.time() - phase_start
            ctx.phase_timings[phase] = round(phase_elapsed, 3)

        # All phases complete
        total_time = time.time() - pipeline_start
        ctx.metadata.processing_time_s = round(total_time, 3)
        ctx.metadata.phase_timings = ctx.phase_timings
        ctx.metadata.issues_detected = ctx.repair_results.get("detected", 0)
        ctx.metadata.issues_auto_fixed = ctx.repair_results.get("auto_fixed", 0)
        ctx.metadata.issues_manual_review = ctx.repair_results.get("manual_review", 0)

        # Try to capture peak memory
        try:
            import psutil
            process = psutil.Process()
            ctx.metadata.peak_memory_mb = round(
                process.memory_info().rss / (1024 * 1024), 1
            )
        except Exception:
            pass

        # Finalize job
        storage.update_job(
            job_id,
            JobUpdate(
                status=JobStatus.SUCCEEDED,
                progress_pct=100.0,
                current_phase="COMPLETE",
                completed_at=dt.datetime.now(dt.timezone.utc),
                expires_at=dt.datetime.now(dt.timezone.utc) + dt.timedelta(
                    hours=settings.job_expiry_hours
                ),
                statistics_json=json.dumps(ctx.statistics),
                quality_json=json.dumps(ctx.quality_report),
                confidence_json=json.dumps(ctx.confidence),
                metadata_json=json.dumps(ctx.metadata.to_dict(), default=str),
            ),
        )

        logger.info(
            "Job %s completed in %.1fs",
            job_id,
            total_time,
        )

    except JobCancelledError:
        storage.update_job(
            job_id,
            JobUpdate(
                status=JobStatus.CANCELLED,
                completed_at=dt.datetime.now(dt.timezone.utc),
            ),
        )
        filesystem.delete_job_files(job_id)
        logger.info("Job %s cancelled", job_id)
        raise

    except Exception:
        # Let the worker handle this
        raise
