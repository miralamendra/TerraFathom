"""
Side-Road Reconnector.

Reconnects side roads that were connected to collapsed parallel carriageways
onto the newly generated analytical centerline, maintaining topological and graph validity.
"""

from __future__ import annotations

import logging
import geopandas as gpd
from shapely.geometry import Point, LineString

logger = logging.getLogger("urban_engine.cleaning.side_road_reconnector")


def reconnect_side_roads(
    roads_gdf: gpd.GeoDataFrame,
    nodes_gdf: gpd.GeoDataFrame,
    original_edge_ids: list[str],
    new_centerline_geom: LineString,
    new_centerline_edge_id: str,
    snap_tolerance_m: float = 0.5,
) -> tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
    """
    Find and reconnect all side roads connecting to the original collapsed edges.
    Updates geometries and topology references (start_node, end_node).
    """
    roads_gdf = roads_gdf.copy()
    nodes_gdf = nodes_gdf.copy()

    # 1. Collect all node IDs that are part of the original collapsed edges
    original_nodes = set()
    for e_id in original_edge_ids:
        if e_id in roads_gdf.index:
            row = roads_gdf.loc[e_id]
            original_nodes.add(row.get("start_node"))
            original_nodes.add(row.get("end_node"))

    original_nodes.discard(None)

    # 2. Find all other edges connected to these nodes (side roads)
    side_road_updates: dict[str, dict] = {}  # edge_id -> {is_start: bool, new_geom: LineString}

    for idx, row in roads_gdf.iterrows():
        if idx in original_edge_ids or idx == new_centerline_edge_id:
            continue

        start_n = row.get("start_node")
        end_n = row.get("end_node")
        geom = row.geometry

        is_connected_at_start = start_n in original_nodes
        is_connected_at_end = end_n in original_nodes

        if is_connected_at_start or is_connected_at_end:
            coords = list(geom.coords)
            
            if is_connected_at_start:
                pt_to_project = Point(coords[0])
                proj_dist = new_centerline_geom.project(pt_to_project)
                snap_pt = new_centerline_geom.interpolate(proj_dist)
                coords[0] = (snap_pt.x, snap_pt.y)
                
                side_road_updates[str(idx)] = {
                    "is_start": True,
                    "new_coords": coords,
                    "snap_pt": (snap_pt.x, snap_pt.y),
                }

            if is_connected_at_end:
                pt_to_project = Point(coords[-1])
                proj_dist = new_centerline_geom.project(pt_to_project)
                snap_pt = new_centerline_geom.interpolate(proj_dist)
                coords[-1] = (snap_pt.x, snap_pt.y)
                
                # If both are true (rare loop edge), update both
                if str(idx) in side_road_updates:
                    side_road_updates[str(idx)]["is_end"] = True
                    side_road_updates[str(idx)]["new_coords"] = coords
                    side_road_updates[str(idx)]["snap_pt_end"] = (snap_pt.x, snap_pt.y)
                else:
                    side_road_updates[str(idx)] = {
                        "is_end": True,
                        "new_coords": coords,
                        "snap_pt": (snap_pt.x, snap_pt.y),
                    }

    # 3. Apply updates to the GeoDataFrame
    for e_id, update in side_road_updates.items():
        if e_id in roads_gdf.index:
            new_geom = LineString(update["new_coords"])
            roads_gdf.at[e_id, "geometry"] = new_geom
            
            # Track modifications
            hist = list(roads_gdf.loc[e_id].get("repair_history", []))
            hist.append(f"RECONNECTED_TO_{new_centerline_edge_id}")
            roads_gdf.at[e_id, "repair_history"] = hist

    return roads_gdf, nodes_gdf
