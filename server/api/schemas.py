"""
API Schemas — Pydantic request/response models.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


# ── Source Schemas ─────────────────────────────────────────────────────────────


class BBoxSchema(BaseModel):
    west: float
    south: float
    east: float
    north: float


class UploadSource(BaseModel):
    kind: str = "upload"
    upload_id: str


class OsmBboxSource(BaseModel):
    kind: str = "osm_bbox"
    bbox: BBoxSchema


class OsmPlaceSource(BaseModel):
    kind: str = "osm_place"
    place_name: str


class ProjectLayersSource(BaseModel):
    kind: str = "project_layers"
    project_id: str
    roads_layer_id: str
    buildings_layer_id: str | None = None
    boundary_layer_id: str | None = None


# ── Job Schemas ───────────────────────────────────────────────────────────────


class CreateJobRequest(BaseModel):
    source: dict[str, Any]
    options: dict[str, Any] = Field(default_factory=dict)


class JobResponse(BaseModel):
    job_id: str
    status: str
    progress_pct: float = 0.0
    current_phase: str | None = None
    phase_description: str | None = None
    warning_count: int = 0
    created_at: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    status_url: str | None = None
    events_url: str | None = None
    result_url: str | None = None


class JobListResponse(BaseModel):
    jobs: list[JobResponse]
    total: int


# ── Upload Schemas ────────────────────────────────────────────────────────────


class UploadResponse(BaseModel):
    upload_id: str
    filename: str
    detected_format: str
    size_bytes: int
    sha256: str
    expires_at: str


# ── Result Schemas ────────────────────────────────────────────────────────────


class ArtifactInfo(BaseModel):
    artifact_id: str
    artifact_type: str
    format: str
    size_bytes: int
    download_url: str


class ConfidenceResponse(BaseModel):
    geometry: float
    topology: float
    connectivity: float
    road_classification: float
    pedestrian_completeness: float
    overall: float


class RepairSummaryResponse(BaseModel):
    detected: int
    auto_fixed: int
    manual_review: int


class JobResultResponse(BaseModel):
    job_id: str
    statistics: dict[str, Any] | None = None
    quality: dict[str, Any] | None = None
    confidence: ConfidenceResponse | None = None
    repair_summary: RepairSummaryResponse | None = None
    metadata: dict[str, Any] | None = None
    artifacts: list[ArtifactInfo] = Field(default_factory=list)
    analysis_crs: str | None = None
    expires_at: str | None = None
    warnings: list[dict[str, Any]] = Field(default_factory=list)


# ── Capabilities ──────────────────────────────────────────────────────────────


class CapabilitiesResponse(BaseModel):
    source_types: list[str]
    file_formats: list[str]
    max_upload_bytes: int
    max_live_query_area_km2: float
    network_profiles: list[str]
    export_formats: list[str]
    sse_available: bool
    engine_version: str
    pipeline_version: str


# ── Error ─────────────────────────────────────────────────────────────────────


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    detail: str | None = None


# ── Earth Engine Satellite Analysis ──────────────────────────────────────────


class EarthEngineRequest(BaseModel):
    geometry: dict[str, Any]
    metrics: list[str] | None = None


class EarthEngineResponse(BaseModel):
    success: bool
    metrics: dict[str, Any]
    center: list[float]
    source: str


class EarthEngineMapRequest(BaseModel):
    geometry: dict[str, Any]
    layer_type: str


class EarthEngineMapResponse(BaseModel):
    success: bool
    mode: str
    tile_url: str | None = None
    geojson: dict[str, Any] | None = None
    legend: list[dict[str, Any]]
    source: str


