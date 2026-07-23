"""
Automatic Network Repair Engine.

Corrects repairable issues (duplicate edges, floating nodes, overlapping crossings)
and keeps audit tracking of resolved vs. manual-review items.
"""

from __future__ import annotations

import logging
import geopandas as gpd
from shapely.geometry import Point, LineString

from urban_engine.validation.validator import NetworkValidator
from urban_engine.topology.shared_node import build_topology
from urban_engine.topology.splitter import split_at_intersections
from urban_engine.cleaning.dangle_detector import detect_dangles, DangleCandidate
from urban_engine.cleaning.endpoint_scorer import score_dangle_connections, EndpointConnectionCandidate

logger = logging.getLogger("urban_engine.cleaning.auto_repair")


def repair_network(
    gdf: gpd.GeoDataFrame,
    nodes_gdf: gpd.GeoDataFrame | None = None,
    snap_tolerance_m: float = 0.5,
    projected_osm_nodes: dict[int, tuple[float, float]] | None = None,
    boundary_geom: any = None,
):
    """
    Automatically repair topological issues.
    If nodes_gdf is provided, returns (repaired_segs, repaired_nodes, repair_summary_counts).
    Otherwise, returns (repaired_segs, repair_summary_counts).
    """
    if gdf.empty:
        if nodes_gdf is not None:
            return gdf, nodes_gdf, {"detected": 0, "auto_fixed": 0, "manual_review": 0}
        return gdf, {"detected": 0, "auto_fixed": 0, "manual_review": 0}

    # Run validation first to capture stats
    validator = NetworkValidator(gdf)
    issues = validator.validate_all(snap_tolerance_m)

    detected = 0
    fixed = 0
    manual = 0

    for issue in issues:
        detected += len(issue.feature_ids)
        if issue.auto_fixable:
            fixed += len(issue.feature_ids)
        else:
            manual += len(issue.feature_ids)

    repaired_gdf = gdf.copy()

    # 1. Repair duplicate edges (exact coordinates only)
    repaired_gdf = _repair_duplicate_edges(repaired_gdf)

    # 2. Repair floating nodes (multi-signal endpoint snap)
    # Detect dangles first
    current_nodes, _ = build_topology(
        repaired_gdf,
        snap_tolerance_m=snap_tolerance_m,
        projected_osm_nodes=projected_osm_nodes,
    )
    
    dangles = detect_dangles(
        repaired_gdf,
        current_nodes,
        boundary_geom=boundary_geom,
    )
    
    candidates = score_dangle_connections(
        dangles,
        repaired_gdf,
        max_search_dist=snap_tolerance_m * 4.0,  # Search a bit wider for scoring
    )

    # Apply auto-repairs
    for cand in candidates:
        edge_id = cand.source_edge_id
        if edge_id not in repaired_gdf.index:
            try:
                edge_id_int = int(edge_id)
                if edge_id_int in repaired_gdf.index:
                    edge_id = edge_id_int
            except ValueError:
                pass

        if edge_id not in repaired_gdf.index:
            continue

        if cand.action == "auto_repair":
            # Adjust source geometry endpoint
            source_geom = repaired_gdf.loc[edge_id].geometry
            coords = list(source_geom.coords)
            
            # Find if start or end node is being snapped
            dangle_node_geom = current_nodes.loc[cand.dangle_node_id].geometry
            if dangle_node_geom.distance(Point(coords[0])) < 0.01:
                coords[0] = cand.snap_point
            else:
                coords[-1] = cand.snap_point
                
            repaired_gdf.at[edge_id, "geometry"] = LineString(coords)
            
            # Track repair in history
            hist = list(repaired_gdf.loc[edge_id].get("repair_history", []))
            hist.append(f"SNAP_ENDPOINT_{cand.dangle_node_id}")
            repaired_gdf.at[edge_id, "repair_history"] = hist
        else:
            # Mark for manual review
            repaired_gdf.at[edge_id, "manual_review"] = 1

    # 3. Split intersections and rebuild topology if nodes_gdf is provided
    if nodes_gdf is not None:
        repaired_gdf = split_at_intersections(
            repaired_gdf,
            snap_tolerance_m=snap_tolerance_m,
        )
        
        repaired_nodes, repaired_segs = build_topology(
            repaired_gdf,
            snap_tolerance_m=snap_tolerance_m,
            projected_osm_nodes=projected_osm_nodes,
        )
        
        logger.info(
            "Auto-repair completed: detected %d connectivity candidates, auto-fixed %d, manual-review %d",
            detected,
            fixed,
            manual,
        )
        
        counts = {
            "detected": detected,
            "auto_fixed": fixed,
            "manual_review": manual,
        }
        return repaired_segs, repaired_nodes, counts
    else:
        logger.info(
            "Auto-repair completed (compat mode): detected %d connectivity candidates, auto-fixed %d, manual-review %d",
            detected,
            fixed,
            manual,
        )
        
        counts = {
            "detected": detected,
            "auto_fixed": fixed,
            "manual_review": manual,
        }
        return repaired_gdf, counts


def _repair_duplicate_edges(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Drop exact coordinate duplicates."""
    if gdf.empty:
        return gdf

    wkt = gdf.geometry.to_wkt()
    gdf_cleaned = gdf.loc[~wkt.duplicated()].copy().reset_index(drop=True)
    return gdf_cleaned
