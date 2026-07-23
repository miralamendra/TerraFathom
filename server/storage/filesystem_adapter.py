"""
Filesystem Artifact Storage.

Manages file artifacts in job-specific directories.
All paths are resolved from registered storage keys — never user input.
"""

from __future__ import annotations

import hashlib
import shutil
from pathlib import Path
from typing import BinaryIO


class FilesystemAdapter:
    """
    Stores artifacts in: <storage_root>/jobs/<job_id>/<filename>
    Uploads in:          <storage_root>/uploads/<upload_id>/<filename>
    Temp staging in:     <storage_root>/staging/<job_id>/
    """

    def __init__(self, storage_root: Path) -> None:
        self._root = storage_root
        self._root.mkdir(parents=True, exist_ok=True)
        (self._root / "jobs").mkdir(exist_ok=True)
        (self._root / "uploads").mkdir(exist_ok=True)
        (self._root / "staging").mkdir(exist_ok=True)

    # ── Paths ─────────────────────────────────────────────────────────

    def job_dir(self, job_id: str) -> Path:
        p = self._root / "jobs" / job_id
        p.mkdir(parents=True, exist_ok=True)
        return p

    def upload_dir(self, upload_id: str) -> Path:
        p = self._root / "uploads" / upload_id
        p.mkdir(parents=True, exist_ok=True)
        return p

    def staging_dir(self, job_id: str) -> Path:
        p = self._root / "staging" / job_id
        p.mkdir(parents=True, exist_ok=True)
        return p

    # ── Write ─────────────────────────────────────────────────────────

    def write_upload(
        self,
        upload_id: str,
        filename: str,
        stream: BinaryIO,
        max_size: int,
    ) -> tuple[Path, int, str]:
        """
        Stream an upload to disk. Returns (path, size, sha256).
        Raises ValueError if max_size exceeded.
        """
        dest = self.upload_dir(upload_id) / filename
        hasher = hashlib.sha256()
        total = 0
        chunk_size = 64 * 1024  # 64 KB

        try:
            with open(dest, "wb") as f:
                while True:
                    chunk = stream.read(chunk_size)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > max_size:
                        raise ValueError(
                            f"Upload exceeds maximum size of {max_size} bytes"
                        )
                    hasher.update(chunk)
                    f.write(chunk)
        except Exception:
            # Clean partial upload
            if dest.exists():
                dest.unlink()
            raise

        return dest, total, hasher.hexdigest()

    def write_job_file(self, job_id: str, filename: str, data: bytes) -> Path:
        """Write a file into the job output directory."""
        dest = self.job_dir(job_id) / filename
        dest.write_bytes(data)
        return dest

    def write_staging_file(self, job_id: str, filename: str, data: bytes) -> Path:
        """Write a temporary staging file."""
        dest = self.staging_dir(job_id) / filename
        dest.write_bytes(data)
        return dest

    # ── Read ──────────────────────────────────────────────────────────

    def resolve_path(self, storage_key: str) -> Path | None:
        """
        Resolve a storage key to a filesystem path.
        Keys are relative to storage root: 'jobs/<id>/file.parquet'
        Returns None if the file doesn't exist.
        """
        resolved = (self._root / storage_key).resolve()
        # Security: ensure resolved path is under storage root
        if not str(resolved).startswith(str(self._root.resolve())):
            return None
        if not resolved.exists():
            return None
        return resolved

    def get_file_size(self, storage_key: str) -> int:
        p = self.resolve_path(storage_key)
        return p.stat().st_size if p else 0

    def compute_checksum(self, storage_key: str) -> str | None:
        p = self.resolve_path(storage_key)
        if not p:
            return None
        hasher = hashlib.sha256()
        with open(p, "rb") as f:
            for chunk in iter(lambda: f.read(64 * 1024), b""):
                hasher.update(chunk)
        return hasher.hexdigest()

    # ── Commit (atomic rename from staging) ───────────────────────────

    def commit_staging(self, job_id: str) -> None:
        """Move all staging files to the job output directory."""
        staging = self.staging_dir(job_id)
        dest = self.job_dir(job_id)
        if not staging.exists():
            return
        for f in staging.iterdir():
            target = dest / f.name
            if target.exists():
                target.unlink()
            shutil.move(str(f), str(target))
        # Remove empty staging dir
        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)

    # ── Cleanup ───────────────────────────────────────────────────────

    def delete_job_files(self, job_id: str) -> None:
        """Remove all files for a job."""
        for subdir in ["jobs", "staging"]:
            p = self._root / subdir / job_id
            if p.exists():
                shutil.rmtree(p, ignore_errors=True)

    def delete_upload(self, upload_id: str) -> None:
        p = self._root / "uploads" / upload_id
        if p.exists():
            shutil.rmtree(p, ignore_errors=True)

    def cleanup_expired_uploads(self, max_age_hours: int = 24) -> int:
        """Remove upload directories older than max_age_hours. Returns count removed."""
        import time

        removed = 0
        uploads_dir = self._root / "uploads"
        if not uploads_dir.exists():
            return 0
        cutoff = time.time() - (max_age_hours * 3600)
        for d in uploads_dir.iterdir():
            if d.is_dir() and d.stat().st_mtime < cutoff:
                shutil.rmtree(d, ignore_errors=True)
                removed += 1
        return removed
