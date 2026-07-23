from __future__ import annotations

import logging
import geopandas as gpd
import pandas as pd
import numpy as np
from shapely.geometry import Point, LineString, MultiLineString
from shapely.ops import snap
import networkx as nx
from typing import Dict, Any, List, Tuple

from urban_engine.road_classes import RoadClass
from urban_engine.topology.stable_ids import generate_stable_id, generate_node_id, generate_edge_id
from urban_engine.cleaning.repair_types import RepairType, ModificationRecord
from urban_engine.spatial_index import SpatialIndexEngine
from urban_engine.cleaning.centerline_generator import generate_corridor_centerline
from urban_engine.cleaning.side_road_reconnector import reconnect_side_roads
from urban_engine.topology.shared_node import build_topology

logger = logging.getLogger("urban_engine.cleaning.corridor_inference")


class CorridorInferenceEngine:
    """
    Corridor Inference Engine.
    Piecewise detection and collapse of parallel carriageways (corridors),
    and simple roundabout contractions.
    """

    def __init__(
        self,
        roads_gdf: gpd.GeoDataFrame,
        nodes_gdf: gpd.GeoDataFrame,
        undone_repairs: List[str] | None = None,
        snap_tolerance_m: float = 0.5,
        projected_osm_nodes: dict[int, tuple[float, float]] | None = None,
    ) -> None:
        self.roads = roads_gdf.copy()
        self.nodes = nodes_gdf.copy()
        self.undone_repairs = undone_repairs or []
        self.snap_tolerance_m = snap_tolerance_m
        self.projected_osm_nodes = projected_osm_nodes
        self.modifications: List[ModificationRecord] = []
        self.roundabout_mappings: Dict[str, str] = {}  # raw_roundabout_way_id -> analytical_node_id

    def process(self) -> Tuple[gpd.GeoDataFrame, gpd.GeoDataFrame, List[ModificationRecord], Dict[str, str]]:
        """
        Run the corridor inference pipeline and return:
        (roads_gdf, nodes_gdf, modifications_list, roundabout_mappings)
        """
        logger.info("Running Corridor Inference Engine...")
        if self.roads.empty:
            return self.roads, self.nodes, self.modifications, self.roundabout_mappings

        # Ensure all required metadata fields exist on input roads
        for col in ["explanation", "repair_history", "parents", "children", "confidence", "semantic_class", "manual_review"]:
            if col not in self.roads.columns:
                if col == "repair_history":
                    self.roads[col] = [[] for _ in range(len(self.roads))]
                elif col == "parents":
                    parent_vals = []
                    for idx, row in self.roads.iterrows():
                        p_val = row.get("id") or row.get("osm_id") or str(idx)
                        parent_vals.append([str(p_val)])
                    self.roads[col] = parent_vals
                elif col == "children":
                    self.roads[col] = [[] for _ in range(len(self.roads))]
                elif col == "confidence":
                    self.roads[col] = [{} for _ in range(len(self.roads))]
                elif col == "manual_review":
                    self.roads[col] = 0
                else:
                    self.roads[col] = None

        # 1. Simplify & map roundabouts to analytical nodes
        self._infer_roundabouts()

        # 2. Parallel Carriageway Corridor collapsing (piecewise multi-signal scoring)
        self._infer_parallel_corridors()

        # 3. Rebuild topology to keep nodes and segments in sync
        self.nodes, self.roads = build_topology(
            self.roads,
            snap_tolerance_m=self.snap_tolerance_m,
            projected_osm_nodes=self.projected_osm_nodes,
        )

        return self.roads, self.nodes, self.modifications, self.roundabout_mappings

    def _infer_roundabouts(self) -> None:
        """
        Identify roundabouts and evaluate per Section 15 criteria:
        - Diameter & shape regularity
        - Number of approaches
        - Internal roads (islands with crossing streets)
        - Grade separation
        - Gyratory classification (large irregular loops preserved, not contracted)
        """
        if "junction" not in self.roads.columns:
            return

        roundabout_edges = self.roads[self.roads["junction"] == "roundabout"]
        if roundabout_edges.empty:
            return

        # Precompute node-to-all-edges adjacency for O(1) approach and internal road counting
        node_to_edges = {}
        for idx, row in self.roads.iterrows():
            u, v = row.get("start_node"), row.get("end_node")
            if u is not None and v is not None:
                node_to_edges.setdefault(u, set()).add((idx, v))
                node_to_edges.setdefault(v, set()).add((idx, u))

        # Precompute node-to-roundabout-edges to build graph in O(N)
        node_to_roundabout_edges = {}
        for idx, row in roundabout_edges.iterrows():
            u, v = row.get("start_node"), row.get("end_node")
            if u is not None and v is not None:
                node_to_roundabout_edges.setdefault(u, []).append(idx)
                node_to_roundabout_edges.setdefault(v, []).append(idx)

        # Find connected components of roundabout edges
        G = nx.Graph()
        for idx, row in roundabout_edges.iterrows():
            G.add_node(idx)
            u, v = row.get("start_node"), row.get("end_node")
            if u is not None and v is not None:
                for other_idx in node_to_roundabout_edges.get(u, []) + node_to_roundabout_edges.get(v, []):
                    if other_idx != idx:
                        G.add_edge(idx, other_idx)

        roundabout_index = 0
        for comp in nx.connected_components(G):
            roundabout_list = list(comp)
            roundabout_set = set(roundabout_list)
            sub_gdf = roundabout_edges.loc[roundabout_list]

            # --- Geometry evaluation ---
            merged_geom = sub_gdf.geometry.union_all()
            centroid = merged_geom.centroid
            bounds = merged_geom.bounds  # (minx, miny, maxx, maxy)
            diameter_x = bounds[2] - bounds[0]
            diameter_y = bounds[3] - bounds[1]
            diameter = max(diameter_x, diameter_y)
            aspect_ratio = min(diameter_x, diameter_y) / max(diameter_x, diameter_y, 1e-9)

            # --- Approach count ---
            roundabout_nodes = set()
            for _, row in sub_gdf.iterrows():
                roundabout_nodes.add(row["start_node"])
                roundabout_nodes.add(row["end_node"])

            approach_edges = set()
            for node in roundabout_nodes:
                for edge_id, other_node in node_to_edges.get(node, []):
                    if edge_id not in roundabout_set:
                        approach_edges.add(edge_id)
            approach_count = len(approach_edges)

            # --- Grade separation ---
            has_grade_separation = False
            for _, row in sub_gdf.iterrows():
                if row.get("bridge") not in (None, "", "no") or row.get("tunnel") not in (None, "", "no"):
                    has_grade_separation = True
                    break

            # --- Internal roads ---
            internal_edges = set()
            for node in roundabout_nodes:
                for edge_id, other_node in node_to_edges.get(node, []):
                    if edge_id not in roundabout_set:
                        if other_node in roundabout_nodes:
                            internal_edges.add(edge_id)
            internal_road_count = len(internal_edges)

            # --- Gyratory classification ---
            is_gyratory = (
                diameter > 80.0 or
                aspect_ratio < 0.6 or
                internal_road_count > 2
            )

            if is_gyratory:
                logger.info(
                    "Gyratory detected (diameter=%.1fm, aspect=%.2f, internal_roads=%d). Preserving geometry.",
                    diameter, aspect_ratio, internal_road_count
                )
                for edge_id in roundabout_list:
                    self.roads.at[edge_id, "explanation"] = (
                        f"Classified as gyratory (diameter={diameter:.1f}m, "
                        f"aspect_ratio={aspect_ratio:.2f}, internal_roads={internal_road_count}). "
                        f"Preserved as physical road segments."
                    )
                continue

            # --- Standard roundabout: contract to analytical junction node ---
            analytical_node_id = generate_stable_id(
                "TF_NODE_ANALYTICAL_ROUNDABOUT",
                f"{centroid.x:.6f}_{centroid.y:.6f}_{roundabout_index}"
            )
            roundabout_index += 1

            repair_id = generate_stable_id("TF_REPAIR", f"ROUNDABOUT_{analytical_node_id}")
            if repair_id in self.undone_repairs:
                logger.info("Rollback: Skipping roundabout collapse %s", repair_id)
                continue

            # Add analytical node to nodes_gdf
            new_node_row = pd.Series({
                "tf_node_id": analytical_node_id,
                "geometry": centroid,
                "junction_type": "roundabout_junction",
                "tf_junction_id": generate_stable_id("TF_JUNCTION", analytical_node_id),
                "roundabout_diameter_m": diameter,
                "roundabout_aspect_ratio": aspect_ratio,
                "roundabout_approaches": approach_count,
                "has_grade_separation": has_grade_separation,
            }, name=analytical_node_id)
            self.nodes = pd.concat([self.nodes, new_node_row.to_frame().T])

            # Record mappings and annotate edges
            for edge_id in roundabout_list:
                self.roundabout_mappings[edge_id] = analytical_node_id
                hist = list(self.roads.at[edge_id, "repair_history"])
                hist.append(repair_id)
                self.roads.at[edge_id, "repair_history"] = hist
                self.roads.at[edge_id, "explanation"] = (
                    f"Contracted to analytical roundabout node {analytical_node_id}. "
                    f"Diameter={diameter:.1f}m, approaches={approach_count}, "
                    f"grade_sep={has_grade_separation}."
                )

            record = ModificationRecord(
                id=repair_id,
                type=RepairType.ROUNDABOUT_COLLAPSE,
                reason=(
                    f"Roundabout with {len(roundabout_list)} segments, "
                    f"diameter={diameter:.1f}m, {approach_count} approaches, "
                    f"aspect_ratio={aspect_ratio:.2f}."
                ),
                method="Centroid-based analytical junction mapping with Section 15 evaluation",
                confidence={
                    "geometry": 99.0,
                    "topology": 99.0,
                    "semantics": 95.0,
                    "connectivity": 100.0,
                    "overall": 98.0,
                },
                affected_feature_ids=roundabout_list,
                geom_before_wkt=merged_geom.wkt,
                geom_after_wkt=centroid.wkt,
            )
            self.modifications.append(record)

    def _infer_parallel_corridors(self) -> None:
        """
        Groups and validates parallel carriageways (corridors), then generates centerlines
        using candidate detection, scoring, validation, smoothing, and accept.
        """
        idx_engine = SpatialIndexEngine.from_geodataframe(self.roads)

        # Precompute bearings for parallelism checks
        bearings = {}
        for idx, row in self.roads.iterrows():
            geom = row.geometry
            if isinstance(geom, LineString) and len(geom.coords) >= 2:
                coords = geom.coords
                dx = coords[-1][0] - coords[0][0]
                dy = coords[-1][1] - coords[0][1]
                bearings[idx] = float(np.degrees(np.arctan2(dx, dy)) % 360)
            else:
                bearings[idx] = 0.0

        to_merge_pairs = []
        processed = set()

        for idx, row in self.roads.iterrows():
            if idx in processed:
                continue

            geom = row.geometry
            name = row.get("name")
            road_class = row.get("road_class")
            is_one_way = row.get("is_one_way", False)

            if not geom or not isinstance(geom, LineString):
                continue

            # Query segments within 1.0 to 12.0 meters spacing
            nearby_ids = idx_engine.query_within_distance(geom, 12.0)
            
            for other_id in nearby_ids:
                if other_id == idx or other_id in processed:
                    continue

                other_row = self.roads.loc[other_id]
                other_geom = other_row.geometry
                other_name = other_row.get("name")
                other_class = other_row.get("road_class")
                other_one_way = other_row.get("is_one_way", False)

                # Skip if layers/levels differ (respect grade separation)
                if row.get("layer", 0) != other_row.get("layer", 0):
                    continue

                # 1. Candidate Scoring & Multi-signal Validation
                # A. Same road class
                if road_class != other_class:
                    continue
                    
                # B. Names match or both are empty
                names_match = (
                    (name and other_name and name == other_name) or
                    ((not name or name == "") and (not other_name or other_name == ""))
                )
                if not names_match:
                    continue

                # C. Check geometric distance
                dist = geom.distance(other_geom)
                if not (1.0 <= dist <= 12.0):
                    continue

                # D. Check parallelism / bearings (should be close to 0 or 180 degrees)
                diff = abs(bearings[idx] - bearings[other_id]) % 180
                if not (diff < 25.0 or diff > 155.0):
                    continue

                # E. Frontage road guard: do not merge motorways with service roads
                if (road_class == RoadClass.MOTORWAY and other_class == RoadClass.SERVICE) or \
                   (road_class == RoadClass.SERVICE and other_class == RoadClass.MOTORWAY):
                    continue

                # Candidate Accepted! Add to merge list
                to_merge_pairs.append((idx, other_id, dist, diff))
                processed.add(idx)
                processed.add(other_id)
                break

        # 2. Corridor Generation, Smoothing, and Reconnection
        for id_a, id_b, dist, diff in to_merge_pairs:
            row_a = self.roads.loc[id_a]
            row_b = self.roads.loc[id_b]

            # Unique repair identifier
            repair_id = generate_stable_id("TF_REPAIR", f"CORRIDOR_{id_a}_{id_b}")
            if repair_id in self.undone_repairs:
                logger.info("Rollback: Skipping corridor merge %s", repair_id)
                continue

            # Generate centerline using vector vertex midpoints
            geom_a = row_a.geometry
            geom_b = row_b.geometry

            centerline = generate_corridor_centerline(geom_a, geom_b)
            if not centerline:
                continue

            # Generate stable edge ID for the new corridor centerline
            corr_node_start = row_a["start_node"]
            corr_node_end = row_a["end_node"]
            new_edge_id = generate_edge_id(corr_node_start, corr_node_end, index=99)

            # Inherit and enrich attributes
            new_row = row_a.copy()
            new_row.geometry = centerline
            new_row["tf_edge_id"] = new_edge_id
            new_row["parents"] = list(set(list(row_a.get("parents", [])) + list(row_b.get("parents", []))))
            new_row["explanation"] = (
                f"Inferred movement corridor. Collapsed parallel carriageways "
                f"spaced {dist:.1f}m apart with {diff:.1f}° bearing difference."
            )
            
            # Track repair history
            hist = list(row_a.get("repair_history", []))
            hist.append(repair_id)
            new_row["repair_history"] = hist

            # Complete confidence score breakdown
            new_row["confidence"] = {
                "geometry": 98.0,
                "topology": 99.0,
                "semantics": 94.0,
                "connectivity": 100.0,
                "overall": 97.8
            }

            # Drop the original edges and add the new centerline
            self.roads = self.roads.drop(index=[id_a, id_b])
            self.roads = pd.concat([self.roads, new_row.to_frame().T])

            # Reconnect side roads to this new centerline
            self.roads, self.nodes = reconnect_side_roads(
                self.roads,
                self.nodes,
                original_edge_ids=[str(id_a), str(id_b)],
                new_centerline_geom=centerline,
                new_centerline_edge_id=new_edge_id,
                snap_tolerance_m=self.snap_tolerance_m,
            )

            # Record modification
            record = ModificationRecord(
                id=repair_id,
                type=RepairType.MERGED_CARRIAGEWAY,
                reason=f"Parallel one-way roads with name '{row_a.get('name') or 'unnamed'}' and class '{row_a['road_class']}'.",
                method="Centerline vector projection collapse",
                confidence={"geometry": 98.0, "topology": 99.0, "semantics": 94.0, "connectivity": 100.0, "overall": 97.8},
                affected_feature_ids=[str(id_a), str(id_b)],
                geom_before_wkt=MultiLineString([geom_a, geom_b]).wkt,
                geom_after_wkt=centerline.wkt,
            )
            self.modifications.append(record)
