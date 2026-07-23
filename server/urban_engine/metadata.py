"""
Run Metadata — Full Reproducibility Record.

Every processing run saves complete provenance so results can be exactly reproduced.
"""

from __future__ import annotations

import platform
import sys
from dataclasses import dataclass, field
from typing import Any

import orjson


def _get_library_versions() -> dict[str, str]:
    """Capture versions of all key geospatial libraries."""
    versions: dict[str, str] = {
        "python": platform.python_version(),
    }
    for lib in [
        "shapely", "geopandas", "pyproj", "pyogrio", "pyarrow",
        "pandas", "numpy", "scipy", "networkx", "osmium",
        "orjson", "psutil", "fastapi", "sqlalchemy",
    ]:
        try:
            mod = __import__(lib)
            versions[lib] = getattr(mod, "__version__", "unknown")
        except ImportError:
            versions[lib] = "not installed"
    return versions


@dataclass
class RunMetadata:
    """Complete metadata for a processing run."""

    # ── Dataset identification ────────────────────────────────────────
    dataset_name: str = ""
    source_kind: str = ""
    source_reference: str = ""
    import_date: str = ""  # ISO-8601

    # ── Spatial ───────────────────────────────────────────────────────
    source_crs: str = ""
    analysis_crs: str = ""
    crs_selection_method: str = ""  # auto_utm, configured, project
    bounding_box: dict[str, float] = field(default_factory=dict)
    boundary_area_km2: float = 0.0
    area_basis: str = ""  # exact_boundary, bbox, user_polygon, derived_extent

    # ── Counts ────────────────────────────────────────────────────────
    road_count: int = 0
    raw_road_count: int = 0
    segment_count: int = 0
    node_count: int = 0
    building_count: int = 0
    directed_edge_count: int = 0
    component_count: int = 0

    # ── Processing ────────────────────────────────────────────────────
    processing_time_s: float = 0.0
    phase_timings: dict[str, float] = field(default_factory=dict)
    peak_memory_mb: float | None = None

    # ── Version ───────────────────────────────────────────────────────
    software_version: str = ""
    engine_version: str = ""
    pipeline_version: str = ""
    library_versions: dict[str, str] = field(default_factory=dict)

    # ── Reproducibility ───────────────────────────────────────────────
    parameters: dict[str, Any] = field(default_factory=dict)
    parameter_hash: str = ""
    input_checksum: str = ""
    result_checksum: str = ""

    # ── Repair summary ────────────────────────────────────────────────
    issues_detected: int = 0
    issues_auto_fixed: int = 0
    issues_manual_review: int = 0

    # ── Attribution ───────────────────────────────────────────────────
    osm_attribution: str | None = None

    # ── Timestamps ────────────────────────────────────────────────────
    created_at: str = ""
    expires_at: str = ""

    def populate_library_versions(self) -> None:
        """Fill in library versions from the current environment."""
        self.library_versions = _get_library_versions()

    def to_json(self) -> bytes:
        """Serialize to JSON bytes (no NaN, no Infinity)."""
        import dataclasses
        return orjson.dumps(
            dataclasses.asdict(self),
            option=orjson.OPT_INDENT_2 | orjson.OPT_SORT_KEYS,
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a dict."""
        import dataclasses
        return dataclasses.asdict(self)

    @staticmethod
    def from_dict(d: dict[str, Any]) -> RunMetadata:
        """Deserialize from a dict."""
        m = RunMetadata()
        for k, v in d.items():
            if hasattr(m, k):
                setattr(m, k, v)
        return m
