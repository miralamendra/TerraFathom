"""
API Router — All Urban Engine endpoints.

Routes are under /api/v1/urban-engine/.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import io
import json
import mimetypes
import re
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Query
from fastapi.responses import FileResponse, StreamingResponse
from sse_starlette.sse import EventSourceResponse

from config import settings
from storage import (
    ArtifactCreate,
    ArtifactType,
    Job,
    JobCreate,
    JobStatus,
    JobUpdate,
    SourceKind,
)
from .schemas import (
    ArtifactInfo,
    CapabilitiesResponse,
    ConfidenceResponse,
    CreateJobRequest,
    ErrorResponse,
    JobListResponse,
    JobResponse,
    JobResultResponse,
    RepairSummaryResponse,
    UploadResponse,
    EarthEngineRequest,
    EarthEngineResponse,
    EarthEngineMapRequest,
    EarthEngineMapResponse,
)

router = APIRouter(prefix="/api/v1/urban-engine", tags=["urban-engine"])

# ── Phase descriptions for the UI ─────────────────────────────────────────────

PHASE_DESCRIPTIONS: dict[str, str] = {
    "VALIDATE_INPUT": "Validating input data",
    "ACQUIRE_SOURCE": "Acquiring source data",
    "STAGE_SOURCE": "Staging source files",
    "RESOLVE_BOUNDARY": "Resolving analysis boundary",
    "SELECT_ANALYSIS_CRS": "Selecting coordinate system",
    "EXTRACT_AND_CLASSIFY_ROADS": "Extracting and classifying roads",
    "CLEAN_ROAD_GEOMETRY": "Cleaning road geometry",
    "VALIDATE_NETWORK": "Validating network topology",
    "REPAIR_NETWORK": "Repairing network issues",
    "BUILD_TOPOLOGY": "Building topology",
    "COMPUTE_DERIVED_ATTRIBUTES": "Computing derived attributes",
    "BUILD_GRAPHS": "Building graph representations",
    "EXTRACT_BUILDINGS": "Extracting buildings",
    "CALCULATE_STATISTICS": "Calculating statistics",
    "CALCULATE_CONFIDENCE": "Calculating confidence scores",
    "RUN_QUALITY_CHECKS": "Running quality checks",
    "GENERATE_WEB_PREVIEW": "Generating web preview",
    "EXPORT": "Exporting output files",
    "SAVE_METADATA": "Saving metadata",
    "COMMIT_ARTIFACTS": "Committing artifacts",
    "COMPLETE": "Complete",
}

# ── Filename sanitization ─────────────────────────────────────────────────────

_SAFE_FILENAME_RE = re.compile(r"[^a-zA-Z0-9._\-]")


def _sanitize_filename(name: str) -> str:
    """Remove unsafe characters from a filename."""
    sanitized = _SAFE_FILENAME_RE.sub("_", name)
    # Prevent path traversal
    sanitized = sanitized.lstrip(".")
    return sanitized[:255] if sanitized else "upload"


def _detect_format(filename: str) -> str:
    """Detect format from filename extension."""
    lower = filename.lower()
    if lower.endswith(".osm.pbf") or lower.endswith(".pbf"):
        return "osm_pbf"
    if lower.endswith(".osm.bz2"):
        return "osm_bz2"
    if lower.endswith(".osm"):
        return "osm_xml"
    if lower.endswith(".geojson") or lower.endswith(".geojson.gz"):
        return "geojson"
    if lower.endswith(".json"):
        return "geojson"
    if lower.endswith(".gpkg"):
        return "geopackage"
    if lower.endswith(".zip"):
        return "shapefile_zip"
    if lower.endswith(".parquet"):
        return "geoparquet"
    if lower.endswith(".fgb"):
        return "flatgeobuf"
    return "unknown"


def _job_to_response(job: Job, base_url: str = "") -> JobResponse:
    phase_desc = PHASE_DESCRIPTIONS.get(job.current_phase or "", None)
    return JobResponse(
        job_id=job.id,
        status=job.status.value,
        progress_pct=job.progress_pct,
        current_phase=job.current_phase,
        phase_description=phase_desc,
        created_at=job.created_at.isoformat() if job.created_at else None,
        started_at=job.started_at.isoformat() if job.started_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        error_code=job.error_code,
        error_message=job.error_message,
        status_url=f"{base_url}/api/v1/urban-engine/jobs/{job.id}",
        events_url=f"{base_url}/api/v1/urban-engine/jobs/{job.id}/events",
        result_url=f"{base_url}/api/v1/urban-engine/jobs/{job.id}/result",
    )


# ── Capabilities ──────────────────────────────────────────────────────────────


@router.get("/capabilities", response_model=CapabilitiesResponse)
async def get_capabilities() -> CapabilitiesResponse:
    return CapabilitiesResponse(
        source_types=["upload", "osm_bbox", "osm_place", "project_layers"],
        file_formats=[
            "osm_pbf", "osm_xml", "osm_bz2",
            "geojson", "geopackage", "shapefile_zip",
            "geoparquet", "flatgeobuf",
        ],
        max_upload_bytes=settings.max_upload_bytes,
        max_live_query_area_km2=settings.max_overpass_area_km2,
        network_profiles=["walk", "bicycle", "drive", "all"],
        export_formats=["geoparquet", "geopackage", "geojson", "graphml"],
        sse_available=True,
        engine_version=settings.engine_version,
        pipeline_version=settings.pipeline_version,
    )


# ── Uploads ───────────────────────────────────────────────────────────────────


@router.post("/uploads", response_model=UploadResponse, status_code=201)
async def upload_file(request: Request, file: UploadFile = File(...)) -> UploadResponse:
    storage = request.app.state.storage
    fs = request.app.state.filesystem

    original_name = file.filename or "upload"
    safe_name = _sanitize_filename(original_name)
    detected = _detect_format(original_name)

    if detected == "unknown":
        raise HTTPException(400, detail="Unsupported file format.")

    upload_id = str(uuid.uuid4())
    storage_name = f"{upload_id}_{safe_name}"

    # Stream upload to disk
    try:
        path, size, sha256 = fs.write_upload(
            upload_id=upload_id,
            filename=storage_name,
            stream=file.file,
            max_size=settings.max_upload_bytes,
        )
    except ValueError as e:
        raise HTTPException(413, detail=str(e))

    # Register upload artifact
    expires_at = dt.datetime.now(dt.timezone.utc) + dt.timedelta(
        hours=settings.upload_expiry_hours
    )

    return UploadResponse(
        upload_id=upload_id,
        filename=original_name,
        detected_format=detected,
        size_bytes=size,
        sha256=sha256,
        expires_at=expires_at.isoformat(),
    )


# ── Jobs ──────────────────────────────────────────────────────────────────────


@router.post("/jobs", response_model=JobResponse, status_code=202)
async def create_job(request: Request, body: CreateJobRequest) -> JobResponse:
    storage = request.app.state.storage
    worker = request.app.state.worker

    source = body.source
    source_kind = SourceKind(source.get("kind", "upload"))

    job_id = str(uuid.uuid4())
    config_json = json.dumps(body.options)

    import hashlib
    config_hash = hashlib.sha256(config_json.encode()).hexdigest()[:16]

    job_create = JobCreate(
        id=job_id,
        owner_id="default",  # No auth system yet
        project_id=None,
        source_kind=source_kind,
        source_reference=json.dumps(source),
        config_json=config_json,
        config_hash=config_hash,
        pipeline_version=settings.pipeline_version,
    )

    job = storage.create_job(job_create)

    # Submit to background worker
    worker.submit(job_id)

    return _job_to_response(job)


@router.get("/jobs", response_model=JobListResponse)
async def list_jobs(
    request: Request,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> JobListResponse:
    storage = request.app.state.storage

    status_filter = JobStatus(status) if status else None
    jobs = storage.list_jobs(owner_id=None, status=status_filter, limit=limit, offset=offset)

    return JobListResponse(
        jobs=[_job_to_response(j) for j in jobs],
        total=len(jobs),
    )


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(request: Request, job_id: str) -> JobResponse:
    storage = request.app.state.storage
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(404, detail="Job not found.")
    return _job_to_response(job)


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(request: Request, job_id: str) -> JobResponse:
    storage = request.app.state.storage
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(404, detail="Job not found.")

    if job.status in (JobStatus.SUCCEEDED, JobStatus.FAILED, JobStatus.CANCELLED):
        raise HTTPException(
            409, detail=f"Cannot cancel job in '{job.status.value}' state."
        )

    job = storage.update_job(
        job_id,
        JobUpdate(
            status=JobStatus.CANCELLING,
            cancellation_requested=True,
        ),
    )
    return _job_to_response(job)


@router.delete("/jobs/{job_id}", status_code=204)
async def delete_job(request: Request, job_id: str) -> None:
    storage = request.app.state.storage
    fs = request.app.state.filesystem
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(404, detail="Job not found.")

    fs.delete_job_files(job_id)
    storage.delete_job(job_id)


# ── SSE Progress ──────────────────────────────────────────────────────────────


@router.get("/jobs/{job_id}/events")
async def job_events(request: Request, job_id: str) -> EventSourceResponse:
    storage = request.app.state.storage

    async def event_generator():
        last_pct = -1.0
        last_phase = ""

        while True:
            job = storage.get_job(job_id)
            if not job:
                yield {"event": "error", "data": json.dumps({"error": "Job not found"})}
                break

            # Emit progress if changed
            if job.progress_pct != last_pct or job.current_phase != last_phase:
                last_pct = job.progress_pct
                last_phase = job.current_phase or ""

                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "progress_pct": job.progress_pct,
                        "phase": job.current_phase,
                        "phase_description": PHASE_DESCRIPTIONS.get(
                            job.current_phase or "", ""
                        ),
                    }),
                }

            # Emit terminal events
            if job.status == JobStatus.SUCCEEDED:
                yield {
                    "event": "complete",
                    "data": json.dumps({"job_id": job_id, "status": "succeeded"}),
                }
                break
            elif job.status == JobStatus.FAILED:
                yield {
                    "event": "failed",
                    "data": json.dumps({
                        "job_id": job_id,
                        "error_code": job.error_code,
                        "error_message": job.error_message,
                    }),
                }
                break
            elif job.status == JobStatus.CANCELLED:
                yield {
                    "event": "cancelled",
                    "data": json.dumps({"job_id": job_id}),
                }
                break

            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


# ── Results ───────────────────────────────────────────────────────────────────


@router.get("/jobs/{job_id}/result", response_model=JobResultResponse)
async def get_job_result(request: Request, job_id: str) -> JobResultResponse:
    storage = request.app.state.storage
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(404, detail="Job not found.")

    if job.status != JobStatus.SUCCEEDED:
        raise HTTPException(
            409, detail=f"Job is in '{job.status.value}' state, no results available."
        )

    artifacts = storage.list_artifacts(job_id)
    artifact_infos = [
        ArtifactInfo(
            artifact_id=a.id,
            artifact_type=a.artifact_type.value,
            format=a.format,
            size_bytes=a.size_bytes,
            download_url=f"/api/v1/urban-engine/jobs/{job_id}/artifacts/{a.id}",
        )
        for a in artifacts
    ]

    confidence = None
    if job.confidence_json:
        c = json.loads(job.confidence_json)
        confidence = ConfidenceResponse(**c)

    repair_summary = None
    if job.metadata_json:
        m = json.loads(job.metadata_json)
        repair_summary = RepairSummaryResponse(
            detected=m.get("issues_detected", 0),
            auto_fixed=m.get("issues_auto_fixed", 0),
            manual_review=m.get("issues_manual_review", 0),
        )

    return JobResultResponse(
        job_id=job_id,
        statistics=json.loads(job.statistics_json) if job.statistics_json else None,
        quality=json.loads(job.quality_json) if job.quality_json else None,
        confidence=confidence,
        repair_summary=repair_summary,
        metadata=json.loads(job.metadata_json) if job.metadata_json else None,
        artifacts=artifact_infos,
        analysis_crs=None,  # Extracted from metadata
        expires_at=job.expires_at.isoformat() if job.expires_at else None,
    )


# ── Artifact Download ─────────────────────────────────────────────────────────


@router.get("/jobs/{job_id}/artifacts/{artifact_id}")
async def download_artifact(
    request: Request, job_id: str, artifact_id: str
) -> FileResponse:
    storage = request.app.state.storage
    fs = request.app.state.filesystem

    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(404, detail="Job not found.")

    artifact = storage.get_artifact(artifact_id)
    if not artifact or artifact.job_id != job_id:
        raise HTTPException(404, detail="Artifact not found.")

    file_path = fs.resolve_path(artifact.storage_key)
    if not file_path:
        raise HTTPException(404, detail="Artifact file not found on disk.")

    content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"

    return FileResponse(
        path=str(file_path),
        media_type=content_type,
        filename=file_path.name,
    )


@router.get("/jobs/{job_id}/geojson/{filename}")
async def get_job_geojson(
    request: Request, job_id: str, filename: str
) -> FileResponse:
    """Serve a GeoJSON file directly from the job directory (fast path)."""
    fs = request.app.state.filesystem

    # Whitelist allowed filenames to prevent path traversal
    ALLOWED_GEOJSON = {
        "preview_segments.geojson",
        "junctions.geojson",
        "raw_roads.geojson",
        "clean_roads.geojson",
        "v2_topology.geojson",
        "corridors.geojson",
        "validation.geojson",
        "repair_points.geojson",
    }
    if filename not in ALLOWED_GEOJSON:
        raise HTTPException(400, detail=f"Invalid GeoJSON filename: {filename}")

    file_path = fs.job_dir(job_id) / filename
    if not file_path.exists():
        raise HTTPException(404, detail=f"GeoJSON file '{filename}' not found for job.")

    return FileResponse(
        path=str(file_path),
        media_type="application/geo+json",
        filename=filename,
    )


# ── Earth Engine Satellite Analysis ──────────────────────────────────────────


@router.post("/earth-engine/analyze", response_model=EarthEngineResponse)
async def analyze_ee_polygon(body: EarthEngineRequest) -> EarthEngineResponse:
    from urban_engine.analysis.earth_engine import analyze_polygon
    try:
        results = analyze_polygon(body.geometry, body.metrics)
        return EarthEngineResponse(**results)
    except Exception as e:
        raise HTTPException(500, detail=f"Satellite analysis failed: {str(e)}")


@router.post("/earth-engine/map-id", response_model=EarthEngineMapResponse)
async def get_ee_map_id(body: EarthEngineMapRequest) -> EarthEngineMapResponse:
    from urban_engine.analysis.earth_engine import get_earth_engine_map
    try:
        results = get_earth_engine_map(body.geometry, body.layer_type)
        return EarthEngineMapResponse(**results)
    except Exception as e:
        raise HTTPException(500, detail=f"Satellite map-id acquisition failed: {str(e)}")


# ── Network Lab Analytics ───────────────────────────────────────────────────

import functools
import networkx as nx

@functools.lru_cache(maxsize=8)
def _cached_load_graph(file_path_str: str) -> nx.MultiDiGraph:
    """Load and cache a GraphML file. LRU cache avoids re-parsing on repeated calls."""
    file_path = Path(file_path_str)
    g = nx.read_graphml(file_path)
    if not isinstance(g, (nx.MultiDiGraph, nx.MultiGraph)):
        mdg = nx.MultiDiGraph()
        mdg.add_nodes_from(g.nodes(data=True))
        mdg.add_edges_from(g.edges(data=True))
        return mdg
    return g

def _load_job_graph_or_404(request: Request, job_id: str):
    storage = request.app.state.storage
    fs = request.app.state.filesystem
    
    artifacts = storage.list_artifacts(job_id)
    graph_art = next((a for a in artifacts if a.artifact_type.value == "physical_graph"), None)
    if not graph_art:
        raise HTTPException(404, detail="Physical graph artifact not found for this job.")
        
    file_path = fs.resolve_path(graph_art.storage_key)
    if not file_path:
        raise HTTPException(404, detail="Physical graph file not found on disk.")
        
    try:
        return _cached_load_graph(str(file_path))
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to parse GraphML file: {str(e)}")


@router.get("/jobs/{job_id}/analysis/centrality")
async def get_job_centrality(
    request: Request,
    job_id: str,
    metric: str = Query(default="degree"),
    top_n: int = Query(default=20, ge=1, le=500),
):
    from urban_engine.analysis.centrality import CentralityAnalyzer, SUPPORTED_METRICS
    from urban_engine.analysis.base import to_undirected
    if metric not in SUPPORTED_METRICS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown metric '{metric}'. Supported: {list(SUPPORTED_METRICS)}",
        )
    g = _load_job_graph_or_404(request, job_id)
    analyzer = CentralityAnalyzer(metric=metric, top_n=top_n)
    # scores dict is now embedded in the result by the analyzer
    return analyzer.timed(g)


@router.get("/jobs/{job_id}/analysis/community")
async def get_job_community(
    request: Request,
    job_id: str,
    algorithm: str = Query(default="louvain"),
    resolution: float = Query(default=1.0, ge=0.1, le=10.0),
):
    from urban_engine.analysis.community import CommunityDetectionAnalyzer, SUPPORTED_ALGORITHMS
    if algorithm not in SUPPORTED_ALGORITHMS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown algorithm '{algorithm}'. Supported: {SUPPORTED_ALGORITHMS}",
        )
    g = _load_job_graph_or_404(request, job_id)
    analyzer = CommunityDetectionAnalyzer(algorithm=algorithm, resolution=resolution)
    return analyzer.timed(g)


@router.get("/jobs/{job_id}/analysis/distribution")
async def get_job_distribution(request: Request, job_id: str):
    from urban_engine.analysis.distribution import DistributionAnalyzer
    g = _load_job_graph_or_404(request, job_id)
    analyzer = DistributionAnalyzer()
    return analyzer.timed(g)


