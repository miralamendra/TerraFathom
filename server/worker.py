"""
Background Worker — Executes Urban Engine jobs in a thread pool.

Only small JSON-serializable values pass through the queue (job_id).
Heavy geospatial objects stay on the worker thread and are read from/written to storage.
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, Future
from typing import Any

from config import settings
from storage import JobStatus, JobUpdate, StorageInterface
from storage.filesystem_adapter import FilesystemAdapter

logger = logging.getLogger("urban_engine.worker")


class BackgroundWorker:
    """
    Thread-pool based background worker.
    Jobs are submitted by job_id only — never GeoDataFrames through the queue.
    """

    def __init__(
        self,
        storage: StorageInterface,
        filesystem: FilesystemAdapter,
        max_workers: int | None = None,
    ) -> None:
        self._storage = storage
        self._filesystem = filesystem
        self._max_workers = max_workers or settings.max_concurrent_jobs
        self._pool = ThreadPoolExecutor(
            max_workers=self._max_workers,
            thread_name_prefix="urban-worker",
        )
        self._futures: dict[str, Future[Any]] = {}

    def submit(self, job_id: str) -> None:
        """Submit a job for background processing."""
        future = self._pool.submit(self._run_job, job_id)
        self._futures[job_id] = future

        # Auto-cleanup callback
        def _on_done(f: Future[Any]) -> None:
            self._futures.pop(job_id, None)

        future.add_done_callback(_on_done)

    def shutdown(self, wait: bool = True) -> None:
        """Shut down the worker pool."""
        self._pool.shutdown(wait=wait)

    def is_running(self, job_id: str) -> bool:
        f = self._futures.get(job_id)
        return f is not None and not f.done()

    def _run_job(self, job_id: str) -> None:
        """Execute the full pipeline for a job. Runs on a worker thread."""
        job = self._storage.get_job(job_id)
        if not job:
            logger.error("Job %s not found in storage", job_id)
            return

        # Skip if already succeeded (idempotent)
        if job.status == JobStatus.SUCCEEDED:
            logger.info("Job %s already succeeded, skipping", job_id)
            return

        # Mark as running
        self._storage.update_job(
            job_id,
            JobUpdate(
                status=JobStatus.RUNNING,
                started_at=dt.datetime.now(dt.timezone.utc),
            ),
        )

        try:
            self._execute_pipeline(job_id)
        except Exception as exc:
            error_ref = traceback.format_exc()
            logger.error("Job %s failed: %s", job_id, exc, exc_info=True)

            # Determine error code
            from urban_engine.exceptions import UrbanEngineError
            if isinstance(exc, UrbanEngineError):
                error_code = exc.code
                safe_message = exc.safe_message
            else:
                error_code = "INTERNAL_ERROR"
                safe_message = "An internal error occurred during processing."

            self._storage.update_job(
                job_id,
                JobUpdate(
                    status=JobStatus.FAILED,
                    completed_at=dt.datetime.now(dt.timezone.utc),
                    error_code=error_code,
                    error_message=safe_message,
                    internal_error_ref=error_ref[:2000],
                ),
            )

    def _execute_pipeline(self, job_id: str) -> None:
        """
        Run the Urban Engine pipeline.
        This is the main orchestration point — phases run sequentially.
        """
        from urban_engine.pipeline import run_pipeline

        run_pipeline(
            job_id=job_id,
            storage=self._storage,
            filesystem=self._filesystem,
        )
