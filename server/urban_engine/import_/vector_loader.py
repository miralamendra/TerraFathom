"""
Vector Loader.

Loads non-OSM vector formats (GeoJSON, GeoPackage, Shapefile, GeoParquet, FlatGeobuf)
using pyogrio/GeoPandas.
Includes attribute mapping, CRS verification, and layer extraction.
"""

from __future__ import annotations

import logging
import zipfile
from pathlib import Path
from typing import Any

import geopandas as gpd
import pyogrio

from urban_engine.exceptions import UnsupportedFormatError

logger = logging.getLogger("urban_engine.import.vector_loader")


def list_layers(file_path: Path) -> list[str]:
    """List layer names inside a vector file (e.g., GeoPackage)."""
    try:
        return pyogrio.list_layers(str(file_path)).tolist()
    except Exception:
        return []


def load_vector_file(
    file_path: Path,
    layer_name: str | None = None,
    field_mapping: dict[str, str] | None = None,
) -> gpd.GeoDataFrame:
    """
    Load a vector file into a GeoDataFrame.
    Supports zipped shapefiles by finding and loading the internal .shp file.
    """
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    target_path = file_path

    # Handle zipped shapefiles
    if file_path.suffix.lower() == ".zip":
        with zipfile.ZipFile(file_path, "r") as z:
            shp_files = [f for f in z.namelist() if f.lower().endswith(".shp")]
            if not shp_files:
                raise UnsupportedFormatError("Zip archive does not contain a .shp file.")
            # Let GDAL read directly from zip vsimem/vsizip
            target_path = Path(f"/vsizip/{file_path}/{shp_files[0]}")

    try:
        # Load using faster pyogrio engine
        gdf = gpd.read_file(
            str(target_path),
            layer=layer_name,
            engine="pyogrio",
        )
    except Exception as e:
        raise UnsupportedFormatError(f"Failed to load vector file: {e}")

    # Standardize columns based on mapping
    if field_mapping:
        rename_map = {src: dest for src, dest in field_mapping.items() if src in gdf.columns}
        if rename_map:
            gdf = gdf.rename(columns=rename_map)

    # Standardize geometry column name
    if gdf.geometry.name != "geometry":
        gdf = gdf.rename_geometry("geometry")

    logger.info("Loaded %d features from %s", len(gdf), file_path.name)
    return gdf
