"""
Boundary Resolver.

Handles boundary loading, buffering (processing halo), and clipping/clamping
geometries at the analysis limits.
"""

from __future__ import annotations

import logging
from typing import Any

import geopandas as gpd
from shapely.geometry import box
from shapely.geometry.base import BaseGeometry

logger = logging.getLogger("urban_engine.cleaning.boundary")


def resolve_boundary_geometry(
    config_bbox: dict[str, float] | None = None,
    boundary_gdf: gpd.GeoDataFrame | None = None,
    target_crs: Any = None,
) -> tuple[BaseGeometry, float]:
    """
    Resolve analysis boundary from either a bounding box or boundary layer.
    Returns (boundary_geometry, area_km2).
    """
    if boundary_gdf is not None and not boundary_gdf.empty:
        # Re-project to analysis CRS if needed
        if target_crs and boundary_gdf.crs != target_crs:
            boundary_gdf = boundary_gdf.to_crs(target_crs)
        
        # Combine geometries
        union_geom = boundary_gdf.geometry.union_all()
        # Area in km²
        area_km2 = union_geom.area / 1_000_000.0
        return union_geom, area_km2

    if config_bbox:
        # Create box from coordinates
        # bbox expected as WGS84: {west, south, east, north}
        geom = box(
            config_bbox["west"],
            config_bbox["south"],
            config_bbox["east"],
            config_bbox["north"],
        )
        
        # Project to calculate precise area
        if target_crs:
            gdf = gpd.GeoDataFrame(geometry=[geom], crs="EPSG:4326").to_crs(target_crs)
            projected_geom = gdf.geometry.iloc[0]
            area_km2 = projected_geom.area / 1_000_000.0
            return projected_geom, area_km2
        
        # Approximate WGS84 calculation if no target_crs
        # Length of degree lat = 111km, lon = 111km * cos(lat)
        from urban_engine.import_.remote_osm import _compute_bbox_area_km2
        return geom, _compute_bbox_area_km2(config_bbox)

    # Fallback to world box
    return box(-180, -90, 180, 90), 5.1e8


def clip_network_to_boundary(
    gdf: gpd.GeoDataFrame,
    boundary_geom: BaseGeometry,
    halo_buffer_m: float = 0.0,
) -> gpd.GeoDataFrame:
    """
    Clip or tag segments based on boundary geometry.
    If halo_buffer_m > 0, we buffer the boundary first.
    """
    if gdf.empty:
        return gdf

    clip_geom = boundary_geom
    if halo_buffer_m > 0.0:
        clip_geom = boundary_geom.buffer(halo_buffer_m)

    # Clip using GeoPandas clip
    clipped = gpd.clip(gdf, clip_geom, keep_geom_type=True)
    
    # Mark segments that cross the original boundary as border segments
    if not clipped.empty:
        clipped["is_boundary_segment"] = ~clipped.geometry.within(boundary_geom)
    
    logger.info(
        "Clipped network: %d features retained from %d original",
        len(clipped),
        len(gdf),
    )
    return clipped
