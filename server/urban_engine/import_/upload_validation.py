"""
Upload Validation & Security.

Protects the server from malicious uploads (Zip Slip, zip bombs, unsafe paths).
Validates formats and sizes before starting the pipeline.
"""

from __future__ import annotations

import os
import zipfile
from pathlib import Path

from config import settings
from urban_engine.exceptions import ArchiveUnsafeError, FileTooLargeError, UnsupportedFormatError


def validate_file_size(file_path: Path, max_bytes: int | None = None) -> None:
    """Validate file size does not exceed the threshold."""
    limit = max_bytes or settings.max_upload_bytes
    if file_path.stat().st_size > limit:
        raise FileTooLargeError(
            f"Uploaded file size ({file_path.stat().st_size} bytes) "
            f"exceeds limit of {limit} bytes."
        )


def validate_extension(filename: str) -> None:
    """Validate file extension is in the allowed list."""
    lower_name = filename.lower()
    allowed = settings.allowed_extensions
    if not any(lower_name.endswith(ext) for ext in allowed):
        raise UnsupportedFormatError(
            f"File format of '{filename}' is not allowed. "
            f"Allowed extensions: {', '.join(allowed)}"
        )


def check_zip_safety(zip_path: Path) -> list[str]:
    """
    Check if a ZIP file is safe to extract (prevent Zip Slip/bombs).
    Returns list of files to extract.
    Raises ArchiveUnsafeError if unsafe.
    """
    safe_files: list[str] = []
    total_uncompressed_size = 0
    max_uncompressed_limit = settings.max_upload_bytes * 5  # 5x safety factor

    with zipfile.ZipFile(zip_path, "r") as z:
        for info in z.infolist():
            # 1. Zip Slip Check: no relative path traversal
            normalized_path = os.path.normpath(info.filename)
            if normalized_path.startswith("..") or normalized_path.startswith("/"):
                raise ArchiveUnsafeError(
                    f"Unsafe file path detected in zip archive: {info.filename}"
                )

            # 2. Cumulative compression ratio check (prevent zip bomb)
            total_uncompressed_size += info.file_size
            if total_uncompressed_size > max_uncompressed_limit:
                raise ArchiveUnsafeError(
                    "Zip file uncompressed size exceeds safety limits (potential zip bomb)."
                )

            safe_files.append(info.filename)

    return safe_files


def validate_shapefile_zip(zip_path: Path) -> bool:
    """
    Ensure a ZIP file contains at least a valid shapefile set (.shp, .shx, .dbf).
    A .prj is highly recommended but we will flag it if missing.
    """
    with zipfile.ZipFile(zip_path, "r") as z:
        filenames = [f.lower() for f in z.namelist()]

        has_shp = any(f.endswith(".shp") for f in filenames)
        has_shx = any(f.endswith(".shx") for f in filenames)
        has_dbf = any(f.endswith(".dbf") for f in filenames)

        if not (has_shp and has_shx and has_dbf):
            raise UnsupportedFormatError(
                "Zip archive does not contain a complete Shapefile set. "
                "Ensure it includes .shp, .shx, and .dbf files."
            )

        return any(f.endswith(".prj") for f in filenames)
