"""
Geometry Confidence Engine.

Scores data quality on 5 dimensions: Geometry, Topology, Connectivity,
Road Classification, and Pedestrian Completeness.
Returns a composite confidence report.
"""

from __future__ import annotations

import logging
from typing import Dict

import geopandas as gpd
import networkx as nx

from urban_engine.road_classes import RoadClass

logger = logging.getLogger("urban_engine.quality.confidence")


def calculate_confidence_scores(
    roads_gdf: gpd.GeoDataFrame,
    nodes_gdf: gpd.GeoDataFrame,
    physical_graph: nx.MultiGraph,
    repair_summary: dict[str, int],
    connectivity_report: dict[str, Any] | None = None,
) -> Dict[str, float]:
    """
    Calculate confidence scores (0-100%) for the preprocessed network across 4 key dimensions:
    Geometry, Topology, Semantics, Connectivity, and a weighted Overall.
    """
    if roads_gdf.empty:
        return {
            "geometry": 0.0,
            "topology": 0.0,
            "semantics": 0.0,
            "connectivity": 0.0,
            "overall": 0.0,
        }

    total_roads = len(roads_gdf)
    total_nodes = len(nodes_gdf)

    # 1. Geometry Confidence
    geom_issues = repair_summary.get("detected", 0)
    geom_score = max(0.0, 100.0 - (geom_issues / total_roads * 100.0)) if total_roads > 0 else 100.0

    # 2. Topology Confidence
    degrees = [d for _, d in physical_graph.degree()] if physical_graph else []
    deg_1 = sum(1 for d in degrees if d == 1)
    topo_score = max(0.0, 100.0 - (deg_1 / total_nodes * 100.0)) if total_nodes > 0 else 100.0

    # 3. Semantics Confidence
    # Based on roads with specified non-UNKNOWN semantic classes
    known_classes = roads_gdf[roads_gdf["road_class"] != RoadClass.UNKNOWN]
    semantics_score = (len(known_classes) / total_roads) * 100.0 if total_roads > 0 else 0.0

    # 4. Connectivity Confidence
    # Derived directly from the reachability analysis in the connectivity report
    if connectivity_report:
        connectivity_score = float(connectivity_report.get("largest_component_pct", 100.0))
    elif physical_graph and total_nodes > 0:
        comps = list(nx.connected_components(physical_graph))
        largest_comp_size = max(len(c) for c in comps) if comps else 0
        connectivity_score = (largest_comp_size / total_nodes) * 100.0
    else:
        connectivity_score = 100.0

    # 4. Pedestrian Completeness Confidence
    # Percentage of local/pedestrian roads with sidewalk tags or class matching
    ped_roads = roads_gdf[roads_gdf["road_class"].isin([RoadClass.PEDESTRIAN, RoadClass.LOCAL])]
    if len(ped_roads) > 0:
        # Check if they have sidewalk, footway, or pedestrian tags
        has_ped_tags = sum(1 for _, r in ped_roads.iterrows() if r.get("highway") in ("footway", "pedestrian", "path", "cycleway") or r.get("sidewalk") not in (None, "no"))
        ped_score = (has_ped_tags / len(ped_roads)) * 100.0
    else:
        ped_score = 100.0

    # 5. Overall Confidence (Weighted Composite)
    overall = (
        0.20 * geom_score +
        0.20 * topo_score +
        0.20 * semantics_score +
        0.20 * connectivity_score +
        0.20 * ped_score
    )

    scores = {
        "geometry": round(geom_score, 1),
        "topology": round(topo_score, 1),
        "connectivity": round(connectivity_score, 1),
        "road_classification": round(semantics_score, 1),
        "pedestrian_completeness": round(ped_score, 1),
        "overall": round(overall, 1),
    }

    logger.info("Confidence scores computed: Overall = %.1f%%", scores["overall"])
    return scores
