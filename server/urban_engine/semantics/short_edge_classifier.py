"""
Short Edge Classifier.

Evaluates short road segments (<15-20m) using topological and semantic context
to distinguish important junction connectors, bridge ramps, or crossings from
redundant noise (driveways, isolated slivers).
"""

from __future__ import annotations

import logging
import geopandas as gpd
import networkx as nx

logger = logging.getLogger("urban_engine.semantics.short_edge_classifier")


def classify_short_edges(
    roads_gdf: gpd.GeoDataFrame,
    nodes_gdf: gpd.GeoDataFrame,
    short_threshold_m: float = 15.0,
) -> gpd.GeoDataFrame:
    """
    Classify short segments. If a segment is shorter than short_threshold_m,
    evaluate if it's an important connector or redundant noise.
    Updates 'is_noise' column to 1 for redundant short edges.
    """
    if roads_gdf.empty:
        return roads_gdf

    roads_gdf = roads_gdf.copy()
    if "is_noise" not in roads_gdf.columns:
        roads_gdf["is_noise"] = 0

    # 1. Build a temporary graph to evaluate connectivity
    G = nx.Graph()
    for idx, row in roads_gdf.iterrows():
        # Only include non-noise edges in connectivity check
        if row.get("is_noise", 0) == 0:
            G.add_edge(row["start_node"], row["end_node"], id=idx)

    short_noise_count = 0

    for idx, row in roads_gdf.iterrows():
        # If already marked as noise, skip
        if row["is_noise"] == 1:
            continue

        geom = row.geometry
        length = geom.length
        
        if length > short_threshold_m:
            continue

        start_node = row["start_node"]
        end_node = row["end_node"]

        # Get node degrees in the graph
        deg_start = G.degree(start_node) if G.has_node(start_node) else 0
        deg_end = G.degree(end_node) if G.has_node(end_node) else 0

        # Heuristic 1: If it's a dead-end (degree-1 at either end)
        if deg_start == 1 or deg_end == 1:
            # It's a short cul-de-sac or driveway.
            # If it's classified as service or local, mark it as noise.
            # If it is a major arterial class, preserve it (incomplete mapping or boundary clip).
            if row.get("road_class") in ("SERVICE", "LOCAL", "UNKNOWN"):
                roads_gdf.at[idx, "is_noise"] = 1
                short_noise_count += 1
                continue

        # Heuristic 2: Check if it connects two important junctions (degree >= 3)
        if deg_start >= 3 and deg_end >= 3:
            # Important junction connector! Keep it.
            continue

        # Heuristic 3: Check if it is a bridge or tunnel link
        if row.get("bridge") or row.get("tunnel"):
            # Bridges/tunnels links are important. Keep it.
            continue

        # Heuristic 4: Check if removing it splits the local graph (cut edge)
        # We check if removing the edge increases the number of connected components.
        if G.has_edge(start_node, end_node):
            # Temporarily remove
            edge_data = G.get_edge_data(start_node, end_node)
            G.remove_edge(start_node, end_node)
            is_connected = nx.has_path(G, start_node, end_node)
            # Restore
            G.add_edge(start_node, end_node, **edge_data)
            
            if not is_connected:
                # Removing this edge would disconnect parts of the network! Keep it.
                continue

        # If it doesn't meet any keeper criteria, and it is a service/local/alley road,
        # classify it as noise.
        if row.get("road_class") in ("SERVICE", "ALLEY", "UNKNOWN"):
            roads_gdf.at[idx, "is_noise"] = 1
            short_noise_count += 1

    logger.info(
        "Short-edge classification complete: classified %d short edges as noise/redundant",
        short_noise_count,
    )

    return roads_gdf
