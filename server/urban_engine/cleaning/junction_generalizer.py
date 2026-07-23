"""
Junction Generalizer.

Detects complex junction zones (clusters of short segments forming a single
real-world intersection) and contracts them to analytical junction nodes
for Space Syntax analysis. Preserves approach bearings and handles:
- Multi-segment junction clusters (channelized turns, slip lanes)
- Large gyratories (detection only — preserved, not contracted)
- Approach bearing preservation for angular analysis
"""

from __future__ import annotations

import logging
import geopandas as gpd
import pandas as pd
import numpy as np
import networkx as nx
from shapely.geometry import Point, LineString
from typing import Dict, Any, List, Tuple

from urban_engine.road_classes import RoadClass
from urban_engine.topology.stable_ids import generate_stable_id, generate_node_id
from urban_engine.cleaning.repair_types import RepairType, ModificationRecord

logger = logging.getLogger("urban_engine.cleaning.junction_generalizer")

# Short segment threshold for junction-zone membership (meters)
JUNCTION_SEGMENT_MAX_LENGTH_M = 15.0

# Maximum diameter for a junction cluster to be contracted (meters)
# Larger clusters are preserved as physical geometry
JUNCTION_MAX_DIAMETER_M = 60.0

# Minimum degree for a node to anchor a junction zone
MIN_ANCHOR_DEGREE = 3


def _compute_bearing(geom: LineString) -> float:
    """Compute forward bearing of a LineString in degrees [0, 360)."""
    if not isinstance(geom, LineString) or len(geom.coords) < 2:
        return 0.0
    coords = geom.coords
    dx = coords[-1][0] - coords[0][0]
    dy = coords[-1][1] - coords[0][1]
    return float(np.degrees(np.arctan2(dx, dy)) % 360)


class JunctionGeneralizer:
    """
    Detects and contracts complex junction zones into analytical nodes.
    """

    def __init__(
        self,
        roads_gdf: gpd.GeoDataFrame,
        nodes_gdf: gpd.GeoDataFrame,
        undone_repairs: List[str] | None = None,
    ) -> None:
        self.roads = roads_gdf.copy()
        self.nodes = nodes_gdf.copy()
        self.undone_repairs = undone_repairs or []
        self.modifications: List[ModificationRecord] = []

    def process(self) -> Tuple[gpd.GeoDataFrame, gpd.GeoDataFrame, List[ModificationRecord]]:
        """
        Run junction generalization and return
        (roads_gdf, nodes_gdf, modifications_list).
        """
        logger.info("Running Junction Generalizer...")
        if self.roads.empty:
            return self.roads, self.nodes, self.modifications

        # 1. Build adjacency graph
        adj: Dict[str, List[Any]] = {}  # node_id -> [edge_ids]
        for idx, row in self.roads.iterrows():
            u = row.get("start_node")
            v = row.get("end_node")
            if u:
                adj.setdefault(u, []).append(idx)
            if v:
                adj.setdefault(v, []).append(idx)

        # 2. Identify short junction-zone segments
        short_edge_ids = set()
        for idx, row in self.roads.iterrows():
            geom = row.geometry
            if isinstance(geom, LineString) and geom.length <= JUNCTION_SEGMENT_MAX_LENGTH_M:
                # Only consider segments connecting high-degree nodes
                u_deg = len(adj.get(row.get("start_node"), []))
                v_deg = len(adj.get(row.get("end_node"), []))
                if u_deg >= MIN_ANCHOR_DEGREE or v_deg >= MIN_ANCHOR_DEGREE:
                    short_edge_ids.add(idx)

        if not short_edge_ids:
            return self.roads, self.nodes, self.modifications

        # 3. Build a graph of short junction segments and find connected clusters
        G = nx.Graph()
        for eid in short_edge_ids:
            if eid in self.roads.index:
                row = self.roads.loc[eid]
                u, v = row.get("start_node"), row.get("end_node")
                G.add_edge(u, v, edge_id=eid)

        junction_index = 0
        for comp in nx.connected_components(G):
            comp_nodes = list(comp)
            if len(comp_nodes) < 2:
                continue

            # Collect edges in this junction cluster
            cluster_edge_ids = []
            for u, v, data in G.edges(comp_nodes, data=True):
                if u in comp and v in comp:
                    eid = data.get("edge_id")
                    if eid:
                        cluster_edge_ids.append(eid)

            if not cluster_edge_ids:
                continue

            # Compute cluster centroid and diameter
            cluster_points = []
            for nid in comp_nodes:
                if nid in self.nodes.index:
                    pt = self.nodes.loc[nid].geometry
                    if pt:
                        cluster_points.append((pt.x, pt.y))

            if len(cluster_points) < 2:
                continue

            xs = [p[0] for p in cluster_points]
            ys = [p[1] for p in cluster_points]
            cx, cy = np.mean(xs), np.mean(ys)
            diameter = max(max(xs) - min(xs), max(ys) - min(ys))

            # Skip clusters that are too large — likely not a single junction
            if diameter > JUNCTION_MAX_DIAMETER_M:
                logger.info(
                    "Junction cluster too large (%.1fm diameter, %d nodes). Preserving.",
                    diameter, len(comp_nodes)
                )
                continue

            # --- Compute approach bearings ---
            # Approaches are non-cluster edges connected to cluster nodes
            approach_bearings: Dict[str, float] = {}
            for nid in comp_nodes:
                for eid in adj.get(nid, []):
                    if eid not in cluster_edge_ids and eid in self.roads.index:
                        bearing = _compute_bearing(self.roads.loc[eid].geometry)
                        approach_bearings[eid] = bearing

            # --- Contract to analytical junction node ---
            analytical_node_id = generate_stable_id(
                "TF_NODE_ANALYTICAL_JUNCTION",
                f"{cx:.6f}_{cy:.6f}_{junction_index}"
            )
            junction_index += 1

            repair_id = generate_stable_id("TF_REPAIR", f"JUNCTION_ZONE_{analytical_node_id}")
            if repair_id in self.undone_repairs:
                logger.info("Rollback: Skipping junction zone contraction %s", repair_id)
                continue

            # Add analytical node
            centroid_pt = Point(cx, cy)
            new_node = pd.Series({
                "tf_node_id": analytical_node_id,
                "geometry": centroid_pt,
                "junction_type": "complex_intersection",
                "tf_junction_id": generate_stable_id("TF_JUNCTION", analytical_node_id),
                "junction_diameter_m": diameter,
                "junction_approaches": len(approach_bearings),
                "approach_bearings": approach_bearings,
            }, name=analytical_node_id)
            self.nodes = pd.concat([self.nodes, new_node.to_frame().T])

            # Reroute approach edges to the analytical node
            for eid, bearing in approach_bearings.items():
                if eid not in self.roads.index:
                    continue
                row = self.roads.loc[eid]
                u, v = row.get("start_node"), row.get("end_node")
                geom = row.geometry

                if u in comp_nodes:
                    # Snap start to centroid
                    coords = list(geom.coords)
                    coords[0] = (cx, cy)
                    self.roads.at[eid, "geometry"] = LineString(coords)
                    self.roads.at[eid, "start_node"] = analytical_node_id

                if v in comp_nodes:
                    # Snap end to centroid
                    coords = list(self.roads.loc[eid].geometry.coords)
                    coords[-1] = (cx, cy)
                    self.roads.at[eid, "geometry"] = LineString(coords)
                    self.roads.at[eid, "end_node"] = analytical_node_id

            # Mark cluster edges for exclusion (they become internal to the analytical node)
            for eid in cluster_edge_ids:
                if eid in self.roads.index:
                    self.roads.at[eid, "explanation"] = (
                        f"Absorbed into analytical junction node {analytical_node_id} "
                        f"(diameter={diameter:.1f}m, {len(approach_bearings)} approaches)."
                    )
                    hist = list(self.roads.at[eid, "repair_history"])
                    hist.append(repair_id)
                    self.roads.at[eid, "repair_history"] = hist
                    # Tag as noise for the generalized profile (but preserved in physical profile)
                    self.roads.at[eid, "is_junction_internal"] = True

            record = ModificationRecord(
                id=repair_id,
                type=RepairType.SIMPLIFY_GEOMETRY,
                reason=(
                    f"Junction cluster with {len(cluster_edge_ids)} internal segments, "
                    f"diameter={diameter:.1f}m, {len(approach_bearings)} approaches."
                ),
                method="Centroid-based junction zone contraction with approach bearing preservation",
                confidence={
                    "geometry": 95.0,
                    "topology": 97.0,
                    "semantics": 90.0,
                    "connectivity": 98.0,
                    "overall": 95.0,
                },
                affected_feature_ids=cluster_edge_ids,
                geom_before_wkt=None,
                geom_after_wkt=centroid_pt.wkt,
            )
            self.modifications.append(record)

        return self.roads, self.nodes, self.modifications
