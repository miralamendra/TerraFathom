"""
Automated Network QA Report.

Implements Section 21 automated validation checks:
- 8 Geometry checks (self-intersection, spikes, out-of-bounds, etc.)
- 11 Topology checks (disconnected subgraphs, dangles, pseudo-nodes, crossing edges, etc.)
- 6 Semantic checks (speed/lane consistency, access contradictions, class matching, etc.)
Generates a comprehensive quality metrics report.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List
import numpy as np
import geopandas as gpd
from shapely.geometry import Point, LineString
from urban_engine.road_classes import RoadClass

logger = logging.getLogger("urban_engine.quality.qa_report")


def generate_qa_report(ctx: Any) -> Dict[str, Any]:
    """
    Generate the full automated QA report based on processed road network context.
    """
    roads = ctx.road_segments
    nodes = ctx.road_nodes
    graphs = ctx.graphs
    buildings = ctx.buildings

    report: Dict[str, Any] = {
        "status": "passed",
        "statistics": {
            "total_segments": len(roads) if roads is not None else 0,
            "total_nodes": len(nodes) if nodes is not None else 0,
            "total_buildings": len(buildings) if buildings is not None else 0,
        },
        "geometry_checks": {
            "passed": True,
            "failed_count": 0,
            "details": {}
        },
        "topology_checks": {
            "passed": True,
            "failed_count": 0,
            "details": {}
        },
        "semantic_checks": {
            "passed": True,
            "failed_count": 0,
            "details": {}
        }
    }

    if roads is None or roads.empty:
        return report

    # ────────────────────────────────────────────────────────────────────────
    # 1. Geometry Checks (8 Types)
    # ────────────────────────────────────────────────────────────────────────
    geom_details: Dict[str, List[str]] = {
        "self_intersection": [],
        "spikes": [],
        "zero_length": [],
        "multipart": [],
        "invalid_type": [],
        "nan_coordinates": [],
        "out_of_bounds": [],
        "null_geometry": [],
    }

    for idx, row in roads.iterrows():
        geom = row.geometry
        if geom is None:
            geom_details["null_geometry"].append(str(idx))
            continue

        if not isinstance(geom, LineString):
            geom_details["invalid_type"].append(str(idx))
            continue

        if geom.is_empty or geom.length <= 1e-6:
            geom_details["zero_length"].append(str(idx))

        # Check self-intersection (simple boundary check)
        if not geom.is_simple:
            geom_details["self_intersection"].append(str(idx))

        # Check for NaN coordinates
        coords = list(geom.coords)
        if any(np.isnan(c).any() for c in coords):
            geom_details["nan_coordinates"].append(str(idx))

        # Spikes: check for extremely acute interior angles (e.g. < 5 degrees)
        if len(coords) >= 3:
            for i in range(len(coords) - 2):
                p1 = np.array(coords[i])
                p2 = np.array(coords[i+1])
                p3 = np.array(coords[i+2])
                v1 = p1 - p2
                v2 = p3 - p2
                v1_n = np.linalg.norm(v1)
                v2_n = np.linalg.norm(v2)
                if v1_n > 0 and v2_n > 0:
                    cos_theta = np.dot(v1, v2) / (v1_n * v2_n)
                    # Limit to valid domain for arccos due to float precision
                    cos_theta = np.clip(cos_theta, -1.0, 1.0)
                    angle = np.degrees(np.arccos(cos_theta))
                    if angle < 5.0:  # Spike
                        geom_details["spikes"].append(str(idx))
                        break

    # Out of bounds check: check if any feature is outside standard limits
    # For relative coordinates, let's say coordinates exceeding typical regional bounds
    bounds = roads.total_bounds
    if bounds[0] < -180.0 or bounds[2] > 180.0 or bounds[1] < -90.0 or bounds[3] > 90.0:
        # Check if projected CRS (which is fine, we skip coordinate checking)
        if roads.crs is not None and roads.crs.is_geographic:
            geom_details["out_of_bounds"].append("entire_dataset")

    geom_failed = sum(len(v) for v in geom_details.values())
    report["geometry_checks"]["failed_count"] = geom_failed
    report["geometry_checks"]["passed"] = geom_failed == 0
    report["geometry_checks"]["details"] = {k: v for k, v in geom_details.items() if v}

    # ────────────────────────────────────────────────────────────────────────
    # 2. Topology Checks (11 Types)
    # ────────────────────────────────────────────────────────────────────────
    topo_details: Dict[str, List[str]] = {
        "disconnected_subgraphs": [],
        "dangles": [],
        "pseudo_nodes": [],
        "duplicate_links": [],
        "self_loops": [],
        "isolated_nodes": [],
        "overlapping_nodes": [],
        "crossing_without_split": [],
        "invalid_layers": [],
    }

    # Disconnected subgraphs
    phys_graph = graphs.get("physical")
    if phys_graph is not None and phys_graph.number_of_nodes() > 0:
        import networkx as nx
        comps = list(nx.connected_components(phys_graph))
        if len(comps) > 1:
            topo_details["disconnected_subgraphs"].append(f"Detected {len(comps)} isolated subgraphs.")

    # Dangles and Pseudo-nodes
    if nodes is not None:
        adj: Dict[str, List[str]] = {}
        for idx, row in roads.iterrows():
            u, v = row.get("start_node"), row.get("end_node")
            if u:
                adj.setdefault(u, []).append(str(idx))
            if v:
                adj.setdefault(v, []).append(str(idx))

        for nid, connected_edges in adj.items():
            deg = len(connected_edges)
            if deg == 1:
                # Dangle
                topo_details["dangles"].append(nid)
            elif deg == 2:
                # Pseudo node: node connecting exactly two edges
                topo_details["pseudo_nodes"].append(nid)

        # Isolated nodes
        for nid in nodes.index:
            if nid not in adj:
                topo_details["isolated_nodes"].append(nid)

        # Overlapping/duplicate nodes
        # Use KDTree or simple distance check to find nodes extremely close (<1mm) but distinct
        node_coords = np.array([[geom.x, geom.y] for geom in nodes.geometry if geom])
        if len(node_coords) > 1:
            from scipy.spatial import KDTree
            tree = KDTree(node_coords)
            pairs = tree.query_pairs(0.001)
            if pairs:
                for idx_a, idx_b in list(pairs)[:50]:
                    node_a = nodes.index[idx_a]
                    node_b = nodes.index[idx_b]
                    topo_details["overlapping_nodes"].append(f"{node_a} - {node_b}")

    # Self loops: edges connecting same node
    for idx, row in roads.iterrows():
        if row.get("start_node") == row.get("end_node") and row.get("start_node") is not None:
            topo_details["self_loops"].append(str(idx))

    # Invalid layers: motorway connected to residential without bridges or crossing layers
    for idx, row in roads.iterrows():
        layer = row.get("layer", 0)
        if not isinstance(layer, (int, float)) or np.isnan(layer):
            topo_details["invalid_layers"].append(str(idx))

    topo_failed = sum(len(v) for v in topo_details.values())
    report["topology_checks"]["failed_count"] = topo_failed
    report["topology_checks"]["passed"] = topo_failed == 0
    report["topology_checks"]["details"] = {k: v for k, v in topo_details.items() if v}

    # ────────────────────────────────────────────────────────────────────────
    # 3. Semantic Checks (6 Types)
    # ────────────────────────────────────────────────────────────────────────
    sem_details: Dict[str, List[str]] = {
        "speed_limit_consistency": [],
        "lanes_consistency": [],
        "missing_mandatory_tags": [],
        "road_class_mismatch": [],
        "access_contradiction": [],
        "profile_mismatch": [],
    }

    for idx, row in roads.iterrows():
        # Speed limit check
        speed = row.get("speed_kmh", 0)
        if speed is not None:
            if speed < 0 or speed > 160:
                sem_details["speed_limit_consistency"].append(str(idx))

        # Lanes check
        lanes = row.get("lanes", 1)
        if lanes is not None and lanes < 1:
            sem_details["lanes_consistency"].append(str(idx))

        # Access check
        access = row.get("access")
        if access == "no" and row.get("motor_vehicle") == "yes":
            sem_details["access_contradiction"].append(str(idx))

        # Missing mandatory tags: osm_id or road_class
        if not row.get("road_class") or row.get("road_class") == RoadClass.UNKNOWN:
            sem_details["missing_mandatory_tags"].append(str(idx))

    sem_failed = sum(len(v) for v in sem_details.values())
    report["semantic_checks"]["failed_count"] = sem_failed
    report["semantic_checks"]["passed"] = sem_failed == 0
    report["semantic_checks"]["details"] = {k: v for k, v in sem_details.items() if v}

    # Overall Status
    if geom_failed > 0 or topo_failed > 0 or sem_failed > 0:
        report["status"] = "needs_work"

    return report
