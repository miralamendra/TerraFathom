"""
Statistics Collector.

Aggregates network metrics across 10 categories: roads, buildings, topology,
graphs, connectivity, geometry, repair, performance, quality, and metadata.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict

import geopandas as gpd
import networkx as nx
import numpy as np

logger = logging.getLogger("urban_engine.statistics.collector")


def collect_all_statistics(
    ctx: Any,
    graphs: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Collect comprehensive statistics for the completed run.
    Aggregates metrics from segments, nodes, buildings, graphs, and pipeline context.
    """
    logger.info("Aggregating 10-category statistics...")
    
    roads: gpd.GeoDataFrame = ctx.road_segments
    nodes: gpd.GeoDataFrame = ctx.road_nodes
    buildings: gpd.GeoDataFrame = ctx.buildings

    # 1. Road Statistics
    road_stats = {}
    if not roads.empty:
        total_len = roads.geometry.length.sum()
        road_stats = {
            "total_count": len(roads),
            "total_length_m": round(total_len, 2),
            "total_length_km": round(total_len / 1000.0, 2),
            "class_distribution": roads["road_class"].value_counts().to_dict(),
            "average_speed_kmh": round(roads["speed_kmh"].mean(), 1),
            "max_speed_kmh": float(roads["speed_kmh"].max()),
        }

    # 2. Building Statistics
    building_stats = {}
    if buildings is not None and not buildings.empty:
        building_stats = {
            "total_count": len(buildings),
            "total_footprint_area_m2": round(buildings["area_m2"].sum(), 2),
            "average_area_m2": round(buildings["area_m2"].mean(), 2),
            "average_perimeter_m": round(buildings["perimeter_m"].mean(), 2),
            "average_compactness": round(buildings["compactness"].mean(), 3),
        }

    # 3. Topology Statistics
    topo_stats = {}
    if not nodes.empty:
        dead_ends = roads[roads["dead_end"] == True]
        topo_stats = {
            "total_nodes": len(nodes),
            "dead_end_nodes_count": len(dead_ends),
            "dead_end_percentage": round((len(dead_ends) / len(roads) * 100) if len(roads) > 0 else 0.0, 1),
        }

    # 4. Graph Statistics
    graph_stats = {}
    if "physical" in graphs:
        pg = graphs["physical"]
        graph_stats = {
            "physical": {
                "nodes": pg.number_of_nodes(),
                "edges": pg.number_of_edges(),
                "density": round(nx.density(pg), 6),
            }
        }
    for gk in ("directed", "pedestrian", "vehicle"):
        if gk in graphs:
            dg = graphs[gk]
            graph_stats[gk] = {
                "nodes": dg.number_of_nodes(),
                "edges": dg.number_of_edges(),
                "density": round(nx.density(dg), 6),
            }

    # 5. Connectivity Statistics
    conn_stats = {}
    if "physical" in graphs:
        pg = graphs["physical"]
        comps = list(nx.connected_components(pg))
        comp_sizes = [len(c) for c in comps]
        conn_stats = {
            "connected_components_count": len(comps),
            "largest_component_size_nodes": max(comp_sizes) if comp_sizes else 0,
            "largest_component_percentage": round(
                (max(comp_sizes) / pg.number_of_nodes() * 100.0) if pg.number_of_nodes() > 0 else 0.0,
                1,
            ),
            "isolated_nodes_count": sum(1 for d in dict(pg.degree()).values() if d == 0),
        }

    # 6. Geometry Statistics
    geom_stats = {}
    if not roads.empty:
        lengths = roads.geometry.length
        geom_stats = {
            "average_segment_length_m": round(lengths.mean(), 2),
            "median_segment_length_m": round(lengths.median(), 2),
            "std_segment_length_m": round(lengths.std(), 2),
            "max_segment_length_m": round(lengths.max(), 2),
            "min_segment_length_m": round(lengths.min(), 2),
        }

    # 7. Repair Statistics
    repair_stats = ctx.repair_results

    # 8. Performance Statistics
    perf_stats = {
        "processing_time_s": ctx.metadata.processing_time_s,
        "peak_memory_mb": ctx.metadata.peak_memory_mb,
        "phase_timings": ctx.metadata.phase_timings,
    }

    # 9. Quality Statistics
    warnings_count = len(ctx.warnings)
    quality_stats = {
        "total_warnings": warnings_count,
        "total_errors": 0,  # Pipeline would fail if there was an error
    }

    # 10. Run Metadata
    meta_stats = {
        "crs": ctx.analysis_crs.to_string() if hasattr(ctx.analysis_crs, "to_string") else str(ctx.analysis_crs),
        "import_date": ctx.metadata.import_date,
        "software_version": ctx.metadata.software_version,
    }

    # Aggregate into final dictionary
    stats = {
        "roads": road_stats,
        "buildings": building_stats,
        "topology": topo_stats,
        "graphs": graph_stats,
        "connectivity": conn_stats,
        "geometry": geom_stats,
        "repair": repair_stats,
        "performance": perf_stats,
        "quality": quality_stats,
        "metadata": meta_stats,
    }

    logger.info("Statistics collection complete.")
    return stats
