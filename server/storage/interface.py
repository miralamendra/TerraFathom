"""
Storage Interface — Repository Pattern.

All database and artifact access goes through this abstraction.
SQLite today, PostGIS tomorrow — zero engine changes.
"""

from __future__ import annotations

import datetime as dt
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


# ── Domain Enums ──────────────────────────────────────────────────────────────


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    CANCELLING = "cancelling"
    CANCELLED = "cancelled"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    EXPIRED = "expired"


class SourceKind(str, Enum):
    UPLOAD = "upload"
    OSM_BBOX = "osm_bbox"
    OSM_PLACE = "osm_place"
    PROJECT_LAYERS = "project_layers"
    REMOTE_URL = "remote_url"


class ArtifactType(str, Enum):
    RAW_ROADS = "raw_roads"
    ROAD_SEGMENTS = "road_segments"
    ROAD_NODES = "road_nodes"
    BUILDINGS = "buildings"
    PHYSICAL_GRAPH = "physical_graph"
    DIRECTED_GRAPH = "directed_graph"
    PEDESTRIAN_GRAPH = "pedestrian_graph"
    VEHICLE_GRAPH = "vehicle_graph"
    GEOPACKAGE = "geopackage"
    STATISTICS = "statistics"
    QUALITY_REPORT = "quality_report"
    CONFIDENCE = "confidence"
    METADATA = "metadata"
    MANIFEST = "manifest"
    PROCESSING_LOG = "processing_log"
    CONFIG = "config"
    PREVIEW_SEGMENTS = "preview_segments"
    PREVIEW_NODES = "preview_nodes"
    PREVIEW_BUILDINGS = "preview_buildings"
    RESULT_BUNDLE = "result_bundle"
    UPLOAD_FILE = "upload_file"


# ── Domain Models ─────────────────────────────────────────────────────────────


@dataclass
class Job:
    id: str
    owner_id: str
    project_id: str | None
    status: JobStatus
    source_kind: SourceKind
    source_reference: str  # JSON
    config_json: str
    config_hash: str
    pipeline_version: str
    queue_task_id: str | None
    progress_pct: float
    current_phase: str | None
    progress_detail: str | None  # JSON
    cancellation_requested: bool
    created_at: dt.datetime
    started_at: dt.datetime | None
    updated_at: dt.datetime
    completed_at: dt.datetime | None
    expires_at: dt.datetime | None
    error_code: str | None
    error_message: str | None
    internal_error_ref: str | None
    statistics_json: str | None
    quality_json: str | None
    confidence_json: str | None
    metadata_json: str | None
    output_manifest_ref: str | None
    input_checksum: str | None
    result_checksum: str | None


@dataclass
class JobCreate:
    id: str
    owner_id: str
    project_id: str | None
    source_kind: SourceKind
    source_reference: str
    config_json: str
    config_hash: str
    pipeline_version: str


@dataclass
class JobUpdate:
    status: JobStatus | None = None
    queue_task_id: str | None = None
    progress_pct: float | None = None
    current_phase: str | None = None
    progress_detail: str | None = None
    cancellation_requested: bool | None = None
    started_at: dt.datetime | None = None
    completed_at: dt.datetime | None = None
    expires_at: dt.datetime | None = None
    error_code: str | None = None
    error_message: str | None = None
    internal_error_ref: str | None = None
    statistics_json: str | None = None
    quality_json: str | None = None
    confidence_json: str | None = None
    metadata_json: str | None = None
    output_manifest_ref: str | None = None
    input_checksum: str | None = None
    result_checksum: str | None = None


@dataclass
class Artifact:
    id: str
    job_id: str
    artifact_type: ArtifactType
    storage_key: str
    format: str
    crs: str | None
    size_bytes: int
    checksum: str | None
    created_at: dt.datetime
    expires_at: dt.datetime | None


@dataclass
class ArtifactCreate:
    id: str
    job_id: str
    artifact_type: ArtifactType
    storage_key: str
    format: str
    crs: str | None
    size_bytes: int
    checksum: str | None


@dataclass
class ProgressUpdate:
    phase: str
    pct: float
    detail: dict[str, Any] | None = None


# ── Storage Interface ─────────────────────────────────────────────────────────


class StorageInterface(ABC):
    """
    Abstract storage layer. Every DB/file operation goes through this.

    Implementations:
      - SQLiteStorageAdapter   (current)
      - PostGISStorageAdapter  (future)
    """

    # ── Job lifecycle ─────────────────────────────────────────────────

    @abstractmethod
    def create_job(self, job: JobCreate) -> Job:
        ...

    @abstractmethod
    def get_job(self, job_id: str) -> Job | None:
        ...

    @abstractmethod
    def update_job(self, job_id: str, updates: JobUpdate) -> Job:
        ...

    @abstractmethod
    def list_jobs(
        self,
        owner_id: str | None = None,
        status: JobStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Job]:
        ...

    @abstractmethod
    def delete_job(self, job_id: str) -> bool:
        ...

    # ── Artifact lifecycle ────────────────────────────────────────────

    @abstractmethod
    def register_artifact(self, artifact: ArtifactCreate) -> Artifact:
        ...

    @abstractmethod
    def get_artifact(self, artifact_id: str) -> Artifact | None:
        ...

    @abstractmethod
    def get_artifact_by_type(self, job_id: str, artifact_type: ArtifactType) -> Artifact | None:
        ...

    @abstractmethod
    def list_artifacts(self, job_id: str) -> list[Artifact]:
        ...

    @abstractmethod
    def delete_artifact(self, artifact_id: str) -> bool:
        ...

    # ── Progress ──────────────────────────────────────────────────────

    @abstractmethod
    def update_progress(
        self,
        job_id: str,
        phase: str,
        pct: float,
        detail: dict[str, Any] | None = None,
    ) -> None:
        ...

    # ── Cleanup ───────────────────────────────────────────────────────

    @abstractmethod
    def get_expired_jobs(self, before: dt.datetime) -> list[Job]:
        ...

    @abstractmethod
    def get_orphaned_artifacts(self) -> list[Artifact]:
        ...

    # ── Lifecycle ─────────────────────────────────────────────────────

    @abstractmethod
    def initialize(self) -> None:
        """Create tables / run migrations if needed."""
        ...

    @abstractmethod
    def close(self) -> None:
        ...
