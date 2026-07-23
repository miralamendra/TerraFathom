"""
Shared Node Topology Builder.

Creates a topologically valid street network from LineString segments.
Identifies intersections, groups matching endpoints (preferring OSM node IDs),
generates stable node IDs, and maps segments to start/end nodes.
"""

from __future__ import annotations

import hashlib
import logging
from typing import Dict, List, Tuple

import geopandas as gpd
import pandas as pd
import numpy as np
from shapely.geometry import Point
from scipy.spatial import KDTree

from urban_engine.topology.stable_ids import generate_stable_id

logger = logging.getLogger("urban_engine.topology.shared_node")


class UnionFind:
    """Disjoint-set data structure for grouping coordinates."""
    def __init__(self, size: int) -> None:
        self.parent = list(range(size))

    def find(self, i: int) -> int:
        if self.parent[i] == i:
            return i
        self.parent[i] = self.find(self.parent[i])
        return self.parent[i]

    def union(self, i: int, j: int) -> bool:
        root_i = self.find(i)
        root_j = self.find(j)
        if root_i != root_j:
            self.parent[root_i] = root_j
            return True
        return False


def build_topology(
    gdf: gpd.GeoDataFrame,
    snap_tolerance_m: float = 0.5,
    projected_osm_nodes: dict[int, tuple[float, float]] | None = None,
) -> Tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
    """
    Build topology from line segments.
    Returns (nodes_gdf, segments_gdf) where:
      - segments_gdf contains 'start_node' and 'end_node' columns.
      - nodes_gdf contains 'node_id' and point geometries.
    
    If projected_osm_nodes is provided, maps coordinates to known OSM node IDs.
    Otherwise, snaps geometrically.
    """
    if gdf.empty:
        empty_nodes = gpd.GeoDataFrame(columns=["node_id", "geometry"], crs=gdf.crs)
        empty_segs = gdf.copy()
        empty_segs["start_node"] = None
        empty_segs["end_node"] = None
        return empty_nodes, empty_segs

    logger.info("Building network topology using OSM nodes and spatial clustering...")

    # 1. Collect all segment endpoints
    endpoints: list[tuple[float, float]] = []
    segment_mappings: list[tuple[int, int]] = []  # index in endpoints for (start, end)
    
    for idx, row in gdf.iterrows():
        geom = row.geometry
        coords = geom.coords
        
        start_pt = (coords[0][0], coords[0][1])
        end_pt = (coords[-1][0], coords[-1][1])
        
        start_idx = len(endpoints)
        endpoints.append(start_pt)
        
        end_idx = len(endpoints)
        endpoints.append(end_pt)
        
        segment_mappings.append((start_idx, end_idx))

    endpoints_arr = np.array(endpoints)
    n_endpoints = len(endpoints_arr)

    # 2. Map coordinates to OSM Node IDs if available
    osm_node_mapping: dict[int, str] = {}  # endpoint_index -> OSM node ID
    if projected_osm_nodes:
        # Build KDTree of OSM nodes
        osm_ids = list(projected_osm_nodes.keys())
        osm_coords = np.array([projected_osm_nodes[nid] for nid in osm_ids])
        
        if len(osm_coords) > 0:
            osm_kdtree = KDTree(osm_coords)
            # Query nearest OSM node for all endpoints within a very small tolerance (1cm)
            dists, indices = osm_kdtree.query(endpoints_arr, distance_upper_bound=0.01)
            for i, (dist, idx) in enumerate(zip(dists, indices)):
                if dist < 0.01:
                    osm_node_mapping[i] = f"osm_{osm_ids[idx]}"

    # 3. Perform Union-Find clustering for geometric snapping within tolerance
    uf = UnionFind(n_endpoints)
    endpoints_kdtree = KDTree(endpoints_arr)
    
    # Query all pairs within snap tolerance
    pairs = endpoints_kdtree.query_pairs(snap_tolerance_m)
    for i, j in pairs:
        # Union the two endpoints
        uf.union(i, j)

    # 4. Group endpoints and resolve final node IDs and coordinates
    groups: dict[int, list[int]] = {}
    for i in range(n_endpoints):
        root = uf.find(i)
        if root not in groups:
            groups[root] = []
        groups[root].append(i)

    node_id_map: dict[int, str] = {}  # endpoint_index -> final_node_id
    node_records: dict[str, dict] = {}  # node_id -> node_record

    for root, indices in groups.items():
        # Find if any endpoint in this group is mapped to an OSM node ID
        group_osm_id = None
        for idx in indices:
            if idx in osm_node_mapping:
                group_osm_id = osm_node_mapping[idx]
                break
                
        # Calculate group centroid
        coords_in_group = endpoints_arr[indices]
        centroid_x = float(np.mean(coords_in_group[:, 0]))
        centroid_y = float(np.mean(coords_in_group[:, 1]))
        
        if group_osm_id:
            # Prefer the OSM node ID and centroid
            node_id = group_osm_id
        else:
            # Generate a stable geometric node ID based on centroid
            coord_str = f"{centroid_x:.3f}_{centroid_y:.3f}"
            h = hashlib.sha256(coord_str.encode()).hexdigest()[:12]
            node_id = f"n_{h}"

        # Assign this node ID to all endpoints in this group
        for idx in indices:
            node_id_map[idx] = node_id

        # Save unique node details
        if node_id not in node_records:
            node_records[node_id] = {
                "node_id": node_id,
                "x": centroid_x,
                "y": centroid_y,
                "geometry": Point(centroid_x, centroid_y),
            }

    # 5. Map segments to final node IDs
    start_nodes = []
    end_nodes = []
    for start_idx, end_idx in segment_mappings:
        start_nodes.append(node_id_map[start_idx])
        end_nodes.append(node_id_map[end_idx])

    # Reconstruct segments
    segments_gdf = gdf.copy()
    segments_gdf["start_node"] = start_nodes
    segments_gdf["end_node"] = end_nodes
    
    # Generate stable edge IDs
    edge_ids = []
    for s, e, idx in zip(start_nodes, end_nodes, segments_gdf.index):
        h = hashlib.sha256(f"{s}_{e}_{idx}".encode()).hexdigest()[:12]
        edge_ids.append(f"e_{h}")
    segments_gdf["edge_id"] = edge_ids
    segments_gdf.set_index("edge_id", inplace=True, drop=False)

    # Reconstruct nodes GeoDataFrame
    nodes_df = pd.DataFrame(list(node_records.values()))
    nodes_gdf = gpd.GeoDataFrame(nodes_df, geometry="geometry", crs=gdf.crs)
    nodes_gdf.set_index("node_id", inplace=True, drop=False)

    logger.info(
        "Topology construction complete: created %d nodes and %d connected segments",
        len(nodes_gdf),
        len(segments_gdf),
    )

    return nodes_gdf, segments_gdf
