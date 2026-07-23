"""
SQLite Storage Adapter — implements StorageInterface.

Swap to PostGIS by implementing the same interface.
"""

from __future__ import annotations

import datetime as dt
import json
import sqlite3
import threading
from pathlib import Path
from typing import Any

from .interface import (
    Artifact,
    ArtifactCreate,
    ArtifactType,
    Job,
    JobCreate,
    JobStatus,
    JobUpdate,
    SourceKind,
    StorageInterface,
)


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _iso(d: dt.datetime | None) -> str | None:
    return d.isoformat() if d else None


def _parse_dt(s: str | None) -> dt.datetime | None:
    if not s:
        return None
    return dt.datetime.fromisoformat(s)


def _row_to_job(row: sqlite3.Row) -> Job:
    return Job(
        id=row["id"],
        owner_id=row["owner_id"],
        project_id=row["project_id"],
        status=JobStatus(row["status"]),
        source_kind=SourceKind(row["source_kind"]),
        source_reference=row["source_reference"],
        config_json=row["config_json"],
        config_hash=row["config_hash"],
        pipeline_version=row["pipeline_version"],
        queue_task_id=row["queue_task_id"],
        progress_pct=row["progress_pct"],
        current_phase=row["current_phase"],
        progress_detail=row["progress_detail"],
        cancellation_requested=bool(row["cancellation_requested"]),
        created_at=_parse_dt(row["created_at"]),  # type: ignore[arg-type]
        started_at=_parse_dt(row["started_at"]),
        updated_at=_parse_dt(row["updated_at"]),  # type: ignore[arg-type]
        completed_at=_parse_dt(row["completed_at"]),
        expires_at=_parse_dt(row["expires_at"]),
        error_code=row["error_code"],
        error_message=row["error_message"],
        internal_error_ref=row["internal_error_ref"],
        statistics_json=row["statistics_json"],
        quality_json=row["quality_json"],
        confidence_json=row["confidence_json"],
        metadata_json=row["metadata_json"],
        output_manifest_ref=row["output_manifest_ref"],
        input_checksum=row["input_checksum"],
        result_checksum=row["result_checksum"],
    )


def _row_to_artifact(row: sqlite3.Row) -> Artifact:
    return Artifact(
        id=row["id"],
        job_id=row["job_id"],
        artifact_type=ArtifactType(row["artifact_type"]),
        storage_key=row["storage_key"],
        format=row["format"],
        crs=row["crs"],
        size_bytes=row["size_bytes"],
        checksum=row["checksum"],
        created_at=_parse_dt(row["created_at"]),  # type: ignore[arg-type]
        expires_at=_parse_dt(row["expires_at"]),
    )


_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    project_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    source_kind TEXT NOT NULL,
    source_reference TEXT NOT NULL,
    config_json TEXT NOT NULL DEFAULT '{}',
    config_hash TEXT NOT NULL DEFAULT '',
    pipeline_version TEXT NOT NULL DEFAULT '1',
    queue_task_id TEXT,
    progress_pct REAL NOT NULL DEFAULT 0.0,
    current_phase TEXT,
    progress_detail TEXT,
    cancellation_requested INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    started_at TEXT,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    expires_at TEXT,
    error_code TEXT,
    error_message TEXT,
    internal_error_ref TEXT,
    statistics_json TEXT,
    quality_json TEXT,
    confidence_json TEXT,
    metadata_json TEXT,
    output_manifest_ref TEXT,
    input_checksum TEXT,
    result_checksum TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_owner ON jobs(owner_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_expires ON jobs(expires_at);

CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    artifact_type TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT '',
    crs TEXT,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    checksum TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_artifacts_job ON artifacts(job_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(artifact_type);
"""


class SQLiteStorageAdapter(StorageInterface):
    """SQLite-backed storage. Thread-safe with check_same_thread=False and threading.Lock."""

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self._conn: sqlite3.Connection | None = None
        self._lock = threading.Lock()

    # ── Lifecycle ─────────────────────────────────────────────────────

    def initialize(self) -> None:
        with self._lock:
            self._db_path.parent.mkdir(parents=True, exist_ok=True)
            self._conn = sqlite3.connect(
                str(self._db_path),
                check_same_thread=False,
                isolation_level="DEFERRED",
            )
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA foreign_keys=ON")
            self._conn.executescript(_SCHEMA_SQL)
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            if self._conn:
                self._conn.close()
                self._conn = None

    @property
    def _db(self) -> sqlite3.Connection:
        if not self._conn:
            raise RuntimeError("Storage not initialized. Call initialize() first.")
        return self._conn

    # ── Jobs ──────────────────────────────────────────────────────────

    def create_job(self, job: JobCreate) -> Job:
        now = _utcnow()
        with self._lock:
            self._db.execute(
                """
                INSERT INTO jobs (
                    id, owner_id, project_id, status, source_kind,
                    source_reference, config_json, config_hash,
                    pipeline_version, progress_pct,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?)
                """,
                (
                    job.id,
                    job.owner_id,
                    job.project_id,
                    JobStatus.QUEUED.value,
                    job.source_kind.value,
                    job.source_reference,
                    job.config_json,
                    job.config_hash,
                    job.pipeline_version,
                    _iso(now),
                    _iso(now),
                ),
            )
            self._db.commit()
        return self.get_job(job.id)  # type: ignore[return-value]

    def get_job(self, job_id: str) -> Job | None:
        with self._lock:
            row = self._db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return _row_to_job(row) if row else None

    def update_job(self, job_id: str, updates: JobUpdate) -> Job:
        sets: list[str] = []
        vals: list[Any] = []

        field_map = {
            "status": updates.status.value if updates.status else None,
            "queue_task_id": updates.queue_task_id,
            "progress_pct": updates.progress_pct,
            "current_phase": updates.current_phase,
            "progress_detail": updates.progress_detail,
            "cancellation_requested": (
                int(updates.cancellation_requested)
                if updates.cancellation_requested is not None
                else None
            ),
            "started_at": _iso(updates.started_at) if updates.started_at else None,
            "completed_at": _iso(updates.completed_at) if updates.completed_at else None,
            "expires_at": _iso(updates.expires_at) if updates.expires_at else None,
            "error_code": updates.error_code,
            "error_message": updates.error_message,
            "internal_error_ref": updates.internal_error_ref,
            "statistics_json": updates.statistics_json,
            "quality_json": updates.quality_json,
            "confidence_json": updates.confidence_json,
            "metadata_json": updates.metadata_json,
            "output_manifest_ref": updates.output_manifest_ref,
            "input_checksum": updates.input_checksum,
            "result_checksum": updates.result_checksum,
        }

        for col, val in field_map.items():
            if val is not None:
                sets.append(f"{col} = ?")
                vals.append(val)

        if not sets:
            return self.get_job(job_id)  # type: ignore[return-value]

        # Always update updated_at
        sets.append("updated_at = ?")
        vals.append(_iso(_utcnow()))
        vals.append(job_id)

        # Enforce monotonic progress
        if updates.progress_pct is not None:
            sql = f"UPDATE jobs SET {', '.join(sets)} WHERE id = ? AND progress_pct <= ?"
            vals.append(updates.progress_pct)
        else:
            sql = f"UPDATE jobs SET {', '.join(sets)} WHERE id = ?"

        with self._lock:
            self._db.execute(sql, vals)
            self._db.commit()
        return self.get_job(job_id)  # type: ignore[return-value]

    def list_jobs(
        self,
        owner_id: str | None = None,
        status: JobStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Job]:
        clauses: list[str] = []
        vals: list[Any] = []

        if owner_id:
            clauses.append("owner_id = ?")
            vals.append(owner_id)
        if status:
            clauses.append("status = ?")
            vals.append(status.value)

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        with self._lock:
            rows = self._db.execute(
                f"SELECT * FROM jobs {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (*vals, limit, offset),
            ).fetchall()
        return [_row_to_job(r) for r in rows]

    def delete_job(self, job_id: str) -> bool:
        with self._lock:
            cur = self._db.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
            self._db.commit()
            count = cur.rowcount
        return count > 0

    # ── Artifacts ─────────────────────────────────────────────────────

    def register_artifact(self, artifact: ArtifactCreate) -> Artifact:
        now = _utcnow()
        with self._lock:
            self._db.execute(
                """
                INSERT INTO artifacts (
                    id, job_id, artifact_type, storage_key, format,
                    crs, size_bytes, checksum, created_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    artifact.id,
                    artifact.job_id,
                    artifact.artifact_type.value,
                    artifact.storage_key,
                    artifact.format,
                    artifact.crs,
                    artifact.size_bytes,
                    artifact.checksum,
                    _iso(now),
                    None,
                ),
            )
            self._db.commit()
        return self.get_artifact(artifact.id)  # type: ignore[return-value]

    def get_artifact(self, artifact_id: str) -> Artifact | None:
        with self._lock:
            row = self._db.execute(
                "SELECT * FROM artifacts WHERE id = ?", (artifact_id,)
            ).fetchone()
        return _row_to_artifact(row) if row else None

    def get_artifact_by_type(
        self, job_id: str, artifact_type: ArtifactType
    ) -> Artifact | None:
        with self._lock:
            row = self._db.execute(
                "SELECT * FROM artifacts WHERE job_id = ? AND artifact_type = ?",
                (job_id, artifact_type.value),
            ).fetchone()
        return _row_to_artifact(row) if row else None

    def list_artifacts(self, job_id: str) -> list[Artifact]:
        with self._lock:
            rows = self._db.execute(
                "SELECT * FROM artifacts WHERE job_id = ? ORDER BY created_at", (job_id,)
            ).fetchall()
        return [_row_to_artifact(r) for r in rows]

    def delete_artifact(self, artifact_id: str) -> bool:
        with self._lock:
            cur = self._db.execute("DELETE FROM artifacts WHERE id = ?", (artifact_id,))
            self._db.commit()
            count = cur.rowcount
        return count > 0

    # ── Progress ──────────────────────────────────────────────────────

    def update_progress(
        self,
        job_id: str,
        phase: str,
        pct: float,
        detail: dict[str, Any] | None = None,
    ) -> None:
        detail_json = json.dumps(detail) if detail else None
        with self._lock:
            # Monotonic: only update if new pct >= current pct
            self._db.execute(
                """
                UPDATE jobs
                SET current_phase = ?, progress_pct = ?, progress_detail = ?,
                    updated_at = ?
                WHERE id = ? AND progress_pct <= ?
                """,
                (phase, pct, detail_json, _iso(_utcnow()), job_id, pct),
            )
            self._db.commit()

    # ── Cleanup ───────────────────────────────────────────────────────

    def get_expired_jobs(self, before: dt.datetime) -> list[Job]:
        with self._lock:
            rows = self._db.execute(
                "SELECT * FROM jobs WHERE expires_at IS NOT NULL AND expires_at < ?",
                (_iso(before),),
            ).fetchall()
        return [_row_to_job(r) for r in rows]

    def get_orphaned_artifacts(self) -> list[Artifact]:
        with self._lock:
            rows = self._db.execute(
                """
                SELECT a.* FROM artifacts a
                LEFT JOIN jobs j ON a.job_id = j.id
                WHERE j.id IS NULL
                """
            ).fetchall()
        return [_row_to_artifact(r) for r in rows]
