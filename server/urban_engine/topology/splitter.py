"""
Segment Splitter.

Splits crossing or intersecting road lines at mutual intersection points
to ensure correct physical graph junctions.
"""

from __future__ import annotations

import logging
import geopandas as gpd
import pandas as pd
from shapely.geometry import LineString, MultiPoint, Point
from shapely.ops import split, unary_union

from urban_engine.spatial_index import SpatialIndexEngine

logger = logging.getLogger("urban_engine.topology.splitter")


def split_at_intersections(
    gdf: gpd.GeoDataFrame,
    snap_tolerance_m: float = 0.5,
) -> gpd.GeoDataFrame:
    """
    Split LineStrings at all crossing and intersection points.
    Leverages spatial index to query intersecting segments.
    """
    if gdf.empty:
        return gdf

    logger.info("Splitting road segments at geometric intersections...")
    
    # 1. Create a spatial index of all roads
    idx_engine = SpatialIndexEngine.from_geodataframe(gdf)
    
    new_rows = []
    processed_count = 0

    # 2. Iterate and split
    for idx, row in gdf.iterrows():
        geom = row.geometry
        if not isinstance(geom, LineString):
            new_rows.append(row)
            continue

        # Find intersecting candidate segments
        candidates = idx_engine.query_intersects(geom)
        
        # Collect intersection points
        split_points = []
        for other_idx in candidates:
            if other_idx == idx:
                continue
            
            other_row = gdf.loc[other_idx]
            
            # Respect grade separation / elevations
            layer_a = row.get("layer", 0) or 0
            layer_b = other_row.get("layer", 0) or 0
            if layer_a != layer_b:
                continue
                
            bridge_a = row.get("bridge", False)
            bridge_b = other_row.get("bridge", False)
            tunnel_a = row.get("tunnel", False)
            tunnel_b = other_row.get("tunnel", False)
            
            if (bridge_a and not bridge_b and not layer_a and not other_row.get("layer")) or \
               (tunnel_a and not tunnel_b and not layer_a and not other_row.get("layer")):
                continue

            other_geom = other_row.geometry
            # Get intersection geom
            inter = geom.intersection(other_geom)
            if inter.is_empty:
                continue
                
            # Collect points (we split lines at points)
            if isinstance(inter, Point):
                # Don't split if it's already an endpoint (existing junction)
                if not (inter.equals(Point(geom.coords[0])) or inter.equals(Point(geom.coords[-1]))):
                    split_points.append(inter)
            elif isinstance(inter, MultiPoint):
                for p in inter.geoms:
                    if not (p.equals(Point(geom.coords[0])) or p.equals(Point(geom.coords[-1]))):
                        split_points.append(p)
            elif isinstance(inter, LineString):
                # Handle overlapping paths — split at endpoints of overlap
                p1 = Point(inter.coords[0])
                p2 = Point(inter.coords[-1])
                if not (p1.equals(Point(geom.coords[0])) or p1.equals(Point(geom.coords[-1]))):
                    split_points.append(p1)
                if not (p2.equals(Point(geom.coords[0])) or p2.equals(Point(geom.coords[-1]))):
                    split_points.append(p2)

        # 3. Perform the split if we have valid split points
        if split_points:
            union_splits = unary_union(split_points)
            try:
                split_geom = split(geom, union_splits)
                for sub_geom in split_geom.geoms:
                    if isinstance(sub_geom, LineString) and sub_geom.length >= snap_tolerance_m:
                        new_row = row.copy()
                        new_row.geometry = sub_geom
                        new_rows.append(new_row)
                processed_count += 1
                continue
            except Exception:
                pass

        new_rows.append(row)

    result_gdf = gpd.GeoDataFrame(new_rows, crs=gdf.crs)
    result_gdf = result_gdf.reset_index(drop=True)

    logger.info(
        "Split intersections complete: split %d roads into %d segments",
        processed_count,
        len(result_gdf),
    )
    return result_gdf
