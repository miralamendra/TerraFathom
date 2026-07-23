"""
CRS Helper.

Handles CRS detection, automatic metric UTM projection selection, and coordinate conversion.
Downstream distance calculations and topological snapping must happen in a metric projection.
"""

from __future__ import annotations

import geopandas as gpd
from pyproj import CRS, Transformer
from pyproj.database import query_utm_crs_info
from shapely.geometry import box
from shapely.geometry.base import BaseGeometry

from urban_engine.exceptions import CRSInvalidError, CRSMissingError


def detect_crs(gdf: gpd.GeoDataFrame) -> CRS:
    """
    Detect the Coordinate Reference System (CRS) of a GeoDataFrame.
    Raises CRSMissingError if no CRS is defined, or CRSInvalidError if invalid.
    """
    if gdf.crs is None:
        raise CRSMissingError("GeoDataFrame has no CRS set.")
    try:
        return CRS(gdf.crs)
    except Exception as e:
        raise CRSInvalidError(f"Invalid CRS: {e}")


def suggest_utm_crs(bounds: dict[str, float] | tuple[float, float, float, float]) -> CRS:
    """
    Determine the optimal UTM zone CRS (EPSG code) for a bounding box.
    Accepts dict (west, south, east, north) or tuple (minx, miny, maxx, maxy) in WGS84.
    """
    if isinstance(bounds, dict):
        minx = bounds.get("west", -180.0)
        miny = bounds.get("south", -90.0)
        maxx = bounds.get("east", 180.0)
        maxy = bounds.get("north", 90.0)
    else:
        minx, miny, maxx, maxy = bounds

    # Calculate centroid
    lon = (minx + maxx) / 2.0
    lat = (miny + maxy) / 2.0

    # Ensure bounds are within standard range
    lon = max(-180.0, min(180.0, lon))
    lat = max(-90.0, min(90.0, lat))

    # Query optimal UTM zone
    try:
        utm_crs_list = query_utm_crs_info(
            datum_name="WGS 84",
            area_of_interest=None,
            longitude=lon,
            latitude=lat,
        )
        if not utm_crs_list:
            # Fallback to general Web Mercator if no UTM matches
            return CRS.from_epsg(3857)
        # Select the first matching UTM code
        best_code = int(utm_crs_list[0].code)
        return CRS.from_epsg(best_code)
    except Exception as e:
        # Fallback
        return CRS.from_epsg(3857)


def project_to_crs(
    gdf: gpd.GeoDataFrame,
    target_crs: CRS | str | int,
) -> gpd.GeoDataFrame:
    """
    Safely project a GeoDataFrame to target CRS.
    If input CRS is missing, raises CRSMissingError.
    """
    if gdf.crs is None:
        raise CRSMissingError("Cannot project GeoDataFrame without a source CRS.")
    try:
        return gdf.to_crs(target_crs)
    except Exception as e:
        raise CRSInvalidError(f"Failed to project to target CRS: {e}")


def get_crs_authority_code(crs: CRS) -> str:
    """Get the standard authority code representation (e.g. 'EPSG:4326')."""
    auth = crs.to_authority()
    if auth:
        return f"{auth[0]}:{auth[1]}"
    return crs.to_string()
