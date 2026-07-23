"""
TerraFathom Universal Urban Network Engine — Configuration.
"""

from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings. Override via environment variables or .env file."""

    # ── App ──────────────────────────────────────────────────────────────
    app_name: str = "TerraFathom Urban Engine"
    app_version: str = "0.1.0"
    engine_version: str = "0.1.0"
    pipeline_version: str = "1"
    debug: bool = False

    # ── Paths ────────────────────────────────────────────────────────────
    base_dir: Path = Path(__file__).resolve().parent
    storage_dir: Path = Path(__file__).resolve().parent / "storage"
    db_path: Path = Path(__file__).resolve().parent / "storage" / "urban_engine.db"

    # ── Upload limits ────────────────────────────────────────────────────
    max_upload_bytes: int = 500 * 1024 * 1024  # 500 MB
    upload_expiry_hours: int = 24
    allowed_extensions: list[str] = [
        ".osm.pbf", ".pbf", ".osm", ".osm.bz2",
        ".geojson", ".geojson.gz", ".json",
        ".gpkg", ".zip",  # zipped shapefile
        ".parquet", ".fgb",
    ]

    # ── Remote OSM ───────────────────────────────────────────────────────
    overpass_url: str = "https://overpass-api.de/api/interpreter"
    nominatim_url: str = "https://nominatim.openstreetmap.org"
    max_overpass_area_km2: float = 500.0
    overpass_timeout_s: int = 300
    nominatim_user_agent: str = "TerraFathom/0.1 (urban-engine)"
    remote_url_ingestion_enabled: bool = False

    # ── Worker ───────────────────────────────────────────────────────────
    max_concurrent_jobs: int = 2
    job_timeout_s: int = 3600  # 1 hour
    job_expiry_hours: int = 72

    # ── Engine defaults ──────────────────────────────────────────────────
    default_snap_tolerance_m: float = 3.0
    default_min_road_length_m: float = 0.1
    default_min_building_area_m2: float = 1.0
    max_networkx_edges: int = 500_000
    topology_batch_size: int = 50_000

    # ── Cleanup ──────────────────────────────────────────────────────────
    cleanup_interval_minutes: int = 60

    model_config = {"env_prefix": "TERRAFATHOM_", "env_file": ".env"}


settings = Settings()
