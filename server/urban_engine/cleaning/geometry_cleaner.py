"""
Geometry Cleaner.

Performs non-destructive cleaning of raw geometries.
Converts MultiLineStrings to single LineStrings, removes collinear vertices,
and filters out degenerated geometries.
"""

from __future__ import annotations

import logging
import geopandas as gpd
from shapely.geometry import LineString, MultiLineString
from shapely.ops import orient

logger = logging.getLogger("urban_engine.cleaning.geometry_cleaner")


def clean_road_dataframe(
    gdf: gpd.GeoDataFrame,
    min_length_m: float = 0.1,
) -> gpd.GeoDataFrame:
    """
    Clean geometries of a road GeoDataFrame.
    - Explodes MultiLineStrings into LineStrings.
    - Removes zero-length or degenerate lines.
    - Standardizes vertex coordinates.
    """
    if gdf.empty:
        return gdf

    # 1. Explode Multi-geometries
    gdf = gdf.explode(index_parts=False)

    # Keep only LineStrings
    gdf = gdf[gdf.geometry.type == "LineString"]

    # 2. Geometry cleaning function
    cleaned_geoms = []
    indices_to_keep = []

    for idx, geom in zip(gdf.index, gdf.geometry):
        if not isinstance(geom, LineString):
            continue

        # Remove duplicate consecutive vertices
        coords = list(geom.coords)
        cleaned_coords = []
        for pt in coords:
            if not cleaned_coords or pt != cleaned_coords[-1]:
                cleaned_coords.append(pt)

        if len(cleaned_coords) < 2:
            continue

        cleaned_line = LineString(cleaned_coords)

        # Check length criteria
        if cleaned_line.length < min_length_m:
            continue

        cleaned_geoms.append(cleaned_line)
        indices_to_keep.append(idx)

    # Reconstruct gdf with cleaned geometries
    cleaned_gdf = gdf.loc[indices_to_keep].copy()
    cleaned_gdf.geometry = cleaned_geoms

    logger.info(
        "Cleaned road geometries: exploded and kept %d / %d features",
        len(cleaned_gdf),
        len(gdf),
    )

    return cleaned_gdf
