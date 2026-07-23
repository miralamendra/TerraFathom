"""
Building Extractor & Metrics.

Extracts building polygons, validates geometries, correlates buildings
with the street network (via Spatial Index), and calculates morphometric statistics
(area, perimeter, compactness).
"""

from __future__ import annotations

import logging
import geopandas as gpd
from shapely.geometry import Polygon, MultiPolygon
from shapely.validation import make_valid

from urban_engine.spatial_index import SpatialIndexEngine

logger = logging.getLogger("urban_engine.buildings.extractor")


def extract_and_enrich_buildings(
    buildings_gdf: gpd.GeoDataFrame,
    roads_gdf: gpd.GeoDataFrame,
    min_area_m2: float = 1.0,
    snap_distance_m: float = 50.0,
) -> gpd.GeoDataFrame:
    """
    Validate, clean, and extract metrics for building footprints.
    Correlates each building with the nearest road segment.
    """
    if buildings_gdf.empty:
        return buildings_gdf

    logger.info("Extracting building footprints and calculating morphometrics...")
    gdf = buildings_gdf.copy()

    # 1. Geometry validation and validation
    valid_geoms = []
    valid_indices = []

    for idx, geom in zip(gdf.index, gdf.geometry):
        if not isinstance(geom, (Polygon, MultiPolygon)):
            continue
        
        # Repair invalid geometries
        if not geom.is_valid:
            geom = make_valid(geom)
            
        if geom.is_empty:
            continue

        # Keep only polygon elements (explode geometry collection if make_valid created one)
        if geom.geom_type == "GeometryCollection":
            polys = [g for g in geom.geoms if g.geom_type in ("Polygon", "MultiPolygon")]
            if not polys:
                continue
            # Merge them
            from shapely.ops import unary_union
            geom = unary_union(polys)

        # Check minimum area
        if geom.area < min_area_m2:
            continue

        valid_geoms.append(geom)
        valid_indices.append(idx)

    gdf = gdf.loc[valid_indices].copy()
    gdf.geometry = valid_geoms

    if gdf.empty:
        return gdf

    # 2. Compute building morphometrics
    # Area, perimeter, and compactness (iso-perimetric ratio)
    areas = []
    perimeters = []
    compactness = []

    for geom in gdf.geometry:
        area = geom.area
        perimeter = geom.length
        
        # Iso-perimetric quotient (1.0 is a perfect circle, lower is more complex)
        ipq = (4 * 3.14159 * area) / (perimeter ** 2) if perimeter > 0 else 0.0
        
        areas.append(round(area, 2))
        perimeters.append(round(perimeter, 2))
        compactness.append(round(min(1.0, max(0.0, ipq)), 3))

    gdf["area_m2"] = areas
    gdf["perimeter_m"] = perimeters
    gdf["compactness"] = compactness

    # 3. Associate with nearest road segment
    if not roads_gdf.empty:
        road_index = SpatialIndexEngine.from_geodataframe(roads_gdf)
        nearest_road_ids = []
        nearest_road_dist = []

        for geom in gdf.geometry:
            centroid = geom.centroid
            # Query nearest road segment ID within distance limit
            nearest = road_index.query_nearest(centroid, max_distance=snap_distance_m)
            if len(nearest) > 0:
                road_id = nearest[0]
                road_geom = roads_gdf.geometry.loc[road_id]
                dist = centroid.distance(road_geom)
                nearest_road_ids.append(road_id)
                nearest_road_dist.append(round(dist, 2))
            else:
                nearest_road_ids.append(None)
                nearest_road_dist.append(None)

        gdf["nearest_road_id"] = nearest_road_ids
        gdf["distance_to_road_m"] = nearest_road_dist

    logger.info("Enriched %d buildings with morphometric attributes", len(gdf))
    return gdf
