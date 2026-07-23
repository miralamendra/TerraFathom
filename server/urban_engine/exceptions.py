"""
Urban Engine — Typed Exceptions & Error Codes.

Every exception maps to a stable error code for API responses.
Internal details stay in logs; users see safe messages.
"""

from __future__ import annotations


class UrbanEngineError(Exception):
    """Base for all Urban Engine exceptions."""

    code: str = "INTERNAL_ERROR"
    safe_message: str = "An internal error occurred."
    status_code: int = 500

    def __init__(self, detail: str | None = None) -> None:
        self.detail = detail or self.safe_message
        super().__init__(self.detail)


# ── Source / Input ────────────────────────────────────────────────────────────


class InvalidSourceError(UrbanEngineError):
    code = "INVALID_SOURCE"
    safe_message = "The provided source is invalid."
    status_code = 400


class UnsupportedFormatError(UrbanEngineError):
    code = "UNSUPPORTED_FORMAT"
    safe_message = "This file format is not supported."
    status_code = 400


class FileTooLargeError(UrbanEngineError):
    code = "FILE_TOO_LARGE"
    safe_message = "The file exceeds the maximum allowed size."
    status_code = 413


class ArchiveUnsafeError(UrbanEngineError):
    code = "ARCHIVE_UNSAFE"
    safe_message = "The archive failed safety checks."
    status_code = 400


# ── CRS ───────────────────────────────────────────────────────────────────────


class CRSMissingError(UrbanEngineError):
    code = "CRS_MISSING"
    safe_message = "No coordinate reference system found in the data."
    status_code = 400


class CRSInvalidError(UrbanEngineError):
    code = "CRS_INVALID"
    safe_message = "The coordinate reference system is invalid."
    status_code = 400


# ── Data Quality ──────────────────────────────────────────────────────────────


class EmptyRoadLayerError(UrbanEngineError):
    code = "EMPTY_ROAD_LAYER"
    safe_message = "No roads found after filtering. Check your source data or profile."
    status_code = 422


class OSMParseFailed(UrbanEngineError):
    code = "OSM_PARSE_FAILED"
    safe_message = "Failed to parse OSM data."
    status_code = 422


class OSMLocationMissing(UrbanEngineError):
    code = "OSM_LOCATION_MISSING"
    safe_message = "Some OSM node locations could not be resolved."
    status_code = 422


# ── Remote ────────────────────────────────────────────────────────────────────


class OverpassTimeoutError(UrbanEngineError):
    code = "OVERPASS_TIMEOUT"
    safe_message = "The OSM Overpass query timed out. Try a smaller area."
    status_code = 504


class RemoteAreaTooLargeError(UrbanEngineError):
    code = "REMOTE_AREA_TOO_LARGE"
    safe_message = (
        "This area is too large for a live OSM query. "
        "Please upload an OSM PBF extract instead."
    )
    status_code = 400


class RemoteDownloadBlockedError(UrbanEngineError):
    code = "REMOTE_DOWNLOAD_BLOCKED"
    safe_message = "The remote URL was blocked by security policy."
    status_code = 403


# ── Processing ────────────────────────────────────────────────────────────────


class TopologyFailedError(UrbanEngineError):
    code = "TOPOLOGY_FAILED"
    safe_message = "Topology construction failed."
    status_code = 500


class DiskSpaceLowError(UrbanEngineError):
    code = "DISK_SPACE_LOW"
    safe_message = "Insufficient disk space to complete processing."
    status_code = 507


class MemoryLimitError(UrbanEngineError):
    code = "MEMORY_LIMIT_REACHED"
    safe_message = "Processing exceeded the memory limit."
    status_code = 500


class ExportFailedError(UrbanEngineError):
    code = "EXPORT_FAILED"
    safe_message = "Failed to generate output files."
    status_code = 500


# ── Job ───────────────────────────────────────────────────────────────────────


class JobCancelledError(UrbanEngineError):
    code = "JOB_CANCELLED"
    safe_message = "The job was cancelled."
    status_code = 200  # Not really an error


class JobNotFoundError(UrbanEngineError):
    code = "JOB_NOT_FOUND"
    safe_message = "Job not found."
    status_code = 404


class JobExpiredError(UrbanEngineError):
    code = "JOB_EXPIRED"
    safe_message = "This job has expired. Please run it again."
    status_code = 410


class ArtifactNotFoundError(UrbanEngineError):
    code = "ARTIFACT_NOT_FOUND"
    safe_message = "Artifact not found."
    status_code = 404


# ── Validation ────────────────────────────────────────────────────────────────


class NetworkValidationError(UrbanEngineError):
    code = "NETWORK_VALIDATION_FAILED"
    safe_message = "Network validation detected critical issues."
    status_code = 422


class RepairFailedError(UrbanEngineError):
    code = "REPAIR_FAILED"
    safe_message = "Automatic repair could not resolve all critical issues."
    status_code = 422
