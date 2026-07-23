"""
Derived Attributes Calculator.

Computes physical and network properties for every edge segment:
bearing, straightness, curvature, road classes, speed limits, lane counts,
dead-end identification, and connected component indices.
"""

from __future__ import annotations

import logging
import math
from typing import Dict, List

import geopandas as gpd
import networkx as nx
import numpy as np
from shapely.geometry import Point

from urban_engine.road_classes import RoadClass, get_default_speed, get_default_lanes

logger = logging.getLogger("urban_engine.graph.derived_attributes")

from typing import Any
def _is_na(val: Any) -> bool:
    if val is None:
        return True
    import pandas as pd
    if isinstance(val, (list, tuple, np.ndarray, pd.Series)):
        if len(val) == 0:
            return True
        try:
            return bool(pd.isna(val).all())
        except Exception:
            return False
    try:
        return bool(pd.isna(val))
    except Exception:
        return False


def calculate_bearing(x1: float, y1: float, x2: float, y2: float) -> float:
    """Calculate compass bearing (0-360 degrees) from (x1, y1) to (x2, y2)."""
    dx = x2 - x1
    dy = y2 - y1
    angle = math.degrees(math.atan2(dx, dy))
    return (angle + 360.0) % 360.0


def compute_edge_attributes(
    segments_gdf: gpd.GeoDataFrame,
    nodes_gdf: gpd.GeoDataFrame,
) -> gpd.GeoDataFrame:
    """
    Compute derived attributes for all segments in the network.
    Modifies GeoDataFrame in place or returns a copy with attributes added.
    """
    if segments_gdf.empty:
        return segments_gdf

    gdf = segments_gdf.copy()

    # Pre-build undirected graph to find node degrees and connected components
    g = nx.Graph()
    for _, row in gdf.iterrows():
        g.add_edge(row["start_node"], row["end_node"], id=row["edge_id"])

    # Map node degrees
    node_degrees = dict(g.degree())

    # Map connected components
    components = list(nx.connected_components(g))
    node_to_component = {}
    for comp_idx, comp in enumerate(components):
        for node in comp:
            node_to_component[node] = comp_idx

    bearings = []
    curvatures = []
    speeds = []
    lanes_list = []
    dead_ends = []
    comp_ids = []
    road_classes = []

    for _, row in gdf.iterrows():
        geom = row.geometry
        coords = geom.coords
        start_pt = coords[0]
        end_pt = coords[-1]

        # 1. Bearing
        bearing = calculate_bearing(start_pt[0], start_pt[1], end_pt[0], end_pt[1])
        bearings.append(round(bearing, 1))

        # 2. Curvature (straight line distance / actual length)
        # 1.0 is perfectly straight, closer to 0.0 is highly curved
        length = geom.length
        straight_dist = math.sqrt((end_pt[0] - start_pt[0])**2 + (end_pt[1] - start_pt[1])**2)
        curvature = straight_dist / length if length > 0 else 1.0
        curvatures.append(round(min(1.0, max(0.0, curvature)), 3))

        # 3. Road Classification & Default Speed/Lanes
        highway = row.get("highway", None)
        # Check if already classified
        r_class = row.get("road_class")
        if not r_class or r_class == RoadClass.UNKNOWN:
            from urban_engine.road_classes import classify_road
            r_class = classify_road(highway)
        road_classes.append(r_class)

        # Speed limit parsing
        speed = row.get("maxspeed")
        if not speed or _is_na(speed):
            speed_val = get_default_speed(r_class)
        else:
            # Parse integer from speed tag (e.g. '50 mph' or '30')
            try:
                digits = "".join(filter(str.isdigit, str(speed)))
                speed_val = float(digits) if digits else get_default_speed(r_class)
            except Exception:
                speed_val = get_default_speed(r_class)
        speeds.append(speed_val)

        # Lanes parsing
        lanes = row.get("lanes")
        if not lanes or _is_na(lanes):
            lanes_val = get_default_lanes(r_class)
        else:
            try:
                digits = "".join(filter(str.isdigit, str(lanes)))
                lanes_val = int(digits) if digits else get_default_lanes(r_class)
            except Exception:
                lanes_val = get_default_lanes(r_class)
        lanes_list.append(lanes_val)

        # 4. Dead end check (degree of either endpoint is 1)
        s_deg = node_degrees.get(row["start_node"], 0)
        e_deg = node_degrees.get(row["end_node"], 0)
        dead_ends.append(s_deg == 1 or e_deg == 1)

        # 5. Connected Component ID
        comp_ids.append(node_to_component.get(row["start_node"], 0))

    gdf["bearing"] = bearings
    gdf["curvature"] = curvatures
    gdf["speed_kmh"] = speeds
    gdf["lanes"] = lanes_list
    gdf["dead_end"] = dead_ends
    gdf["connected_component"] = comp_ids
    gdf["road_class"] = road_classes

    # Additional defaults
    if "bridge" not in gdf.columns:
        gdf["bridge"] = False
    if "tunnel" not in gdf.columns:
        gdf["tunnel"] = False
    if "level" not in gdf.columns:
        gdf["level"] = 0
    if "layer" not in gdf.columns:
        gdf["layer"] = 0

    logger.info("Computed derived edge attributes for %d segments", len(gdf))
    return gdf
