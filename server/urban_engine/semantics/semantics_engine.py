from __future__ import annotations

import logging
import geopandas as gpd
import pandas as pd
import numpy as np
from shapely.geometry import Point, LineString
import networkx as nx
from typing import Dict, Any, Tuple

from urban_engine.road_classes import RoadClass
from urban_engine.topology.stable_ids import generate_node_id, generate_edge_id, generate_corridor_id, generate_junction_id

logger = logging.getLogger("urban_engine.semantics.semantics_engine")

class SemanticsEngine:
    """
    Infers structural and flow semantics of the topological network.
    Runs after topology construction and before corridor inference.
    """

    def __init__(
        self,
        roads_gdf: gpd.GeoDataFrame,
        nodes_gdf: gpd.GeoDataFrame,
        config: Any | None = None,
    ) -> None:
        self.roads = roads_gdf.copy()
        self.nodes = nodes_gdf.copy()
        self.config = config

    def process(self) -> Tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
        """
        Run the semantic classification and return (roads_gdf, nodes_gdf) with semantic properties.
        """
        logger.info("Running Network Semantics Engine...")
        if self.roads.empty:
            return self.roads, self.nodes

        # 1. Initialize TF Stable IDs for nodes and edges
        self._initialize_stable_ids()

        # 2. Classify road segment semantics
        self._classify_road_semantics()

        # 3. Apply profile-aware noise and short-edge classification
        self._classify_noise_and_short_edges()

        # 4. Classify node junction role semantics
        self._classify_junction_semantics()

        # 5. Compute Corridor Continuity and Functional Hierarchy
        self._compute_corridor_continuity()

        return self.roads, self.nodes

    def _classify_noise_and_short_edges(self) -> None:
        """Run profile-aware noise and short-edge classification."""
        from urban_engine.semantics.noise_classifier import classify_noise
        from urban_engine.semantics.short_edge_classifier import classify_short_edges

        from urban_engine.config import AnalysisProfile
        profile = self.config.analysis_profile if self.config else AnalysisProfile.PHYSICAL_VEHICLE
        include_private = self.config.roads.include_private_access if self.config else False
        include_construction = self.config.roads.include_construction if self.config else False

        self.roads = classify_noise(
            self.roads,
            profile=profile,
            include_private_access=include_private,
            include_construction=include_construction,
        )
        self.roads = classify_short_edges(
            self.roads,
            self.nodes,
        )

    def _initialize_stable_ids(self) -> None:
        """Assign prefix-based, deterministic stable IDs to nodes and edges."""
        # Nodes
        node_ids = []
        for _, row in self.nodes.iterrows():
            geom = row.geometry
            node_ids.append(generate_node_id(geom.x, geom.y))
        # Map old node indices to new stable IDs for edges mapping
        old_to_new_nodes = dict(zip(self.nodes.index, node_ids))

        self.nodes["tf_node_id"] = node_ids
        self.nodes.set_index("tf_node_id", inplace=True, drop=False)

        # Edges (Roads)
        edge_ids = []
        new_start_nodes = []
        new_end_nodes = []
        
        # Track duplicate edge counts to increment index in ID generation
        edge_count_tracker = {}

        for idx, row in self.roads.iterrows():
            start_old = row.get("start_node")
            end_old = row.get("end_node")

            start_new = old_to_new_nodes.get(start_old, "TF_NODE_unknown")
            end_new = old_to_new_nodes.get(end_old, "TF_NODE_unknown")

            new_start_nodes.append(start_new)
            new_end_nodes.append(end_new)

            pair_key = tuple(sorted([start_new, end_new]))
            idx_num = edge_count_tracker.get(pair_key, 0)
            edge_count_tracker[pair_key] = idx_num + 1

            edge_ids.append(generate_edge_id(start_new, end_new, idx_num))

        self.roads["tf_edge_id"] = edge_ids
        self.roads["start_node"] = new_start_nodes
        self.roads["end_node"] = new_end_nodes
        self.roads.set_index("tf_edge_id", inplace=True, drop=False)

    def _classify_road_semantics(self) -> None:
        """Classify advanced road attributes (transit-only, shared space, etc.)."""
        # Transit-only roads
        self.roads["is_transit_only"] = False
        if "busway" in self.roads.columns:
            self.roads["is_transit_only"] = self.roads["busway"].notna() & (self.roads["busway"] != "")
        
        # Shared spaces
        self.roads["is_shared_space"] = False
        if "highway" in self.roads.columns:
            self.roads["is_shared_space"] = self.roads["highway"].isin(["living_street", "pedestrian"])

        # Lanes and directionality
        if "lanes" not in self.roads.columns:
            self.roads["lanes"] = 1
        else:
            self.roads["lanes"] = self.roads["lanes"].fillna(1).astype(int)

        self.roads["is_one_way"] = False
        if "oneway" in self.roads.columns:
            self.roads["is_one_way"] = self.roads["oneway"].isin(["yes", "1", "-1", "True", True])

    def _classify_junction_semantics(self) -> None:
        """Classify nodes into semantic junction categories based on degree and road hierarchies."""
        # Build adjacency using start/end nodes
        adj_dict = {}
        for _, row in self.roads.iterrows():
            u, v = row["start_node"], row["end_node"]
            if u not in adj_dict:
                adj_dict[u] = []
            if v not in adj_dict:
                adj_dict[v] = []
            adj_dict[u].append(row["tf_edge_id"])
            adj_dict[v].append(row["tf_edge_id"])

        junction_types = []
        for node_id, row in self.nodes.iterrows():
            connected_edges = adj_dict.get(node_id, [])
            degree = len(connected_edges)

            if degree == 0:
                junction_types.append("isolated")
            elif degree == 1:
                junction_types.append("cul_de_sac")
            elif degree == 2:
                junction_types.append("continuity_point")
            else:
                # Degree >= 3
                connected_classes = [self.roads.loc[e, "road_class"] for e in connected_edges if e in self.roads.index]
                
                # Check for roundabouts
                is_roundabout_junc = False
                for e in connected_edges:
                    if e in self.roads.index and self.roads.loc[e].get("junction") == "roundabout":
                        is_roundabout_junc = True
                        break

                if is_roundabout_junc:
                    junction_types.append("roundabout_junction")
                elif any(rc in [RoadClass.MOTORWAY, RoadClass.HIGHWAY] for rc in connected_classes):
                    junction_types.append("complex_interchange")
                elif any(rc in [RoadClass.ARTERIAL] for rc in connected_classes):
                    junction_types.append("major_intersection")
                else:
                    junction_types.append("minor_intersection")

        self.nodes["junction_type"] = junction_types
        self.nodes["tf_junction_id"] = [generate_junction_id(nid) for nid in self.nodes["tf_node_id"]]

    def _compute_corridor_continuity(self) -> None:
        """Computes functional hierarchy and groups contiguous roads sharing names/classes into corridor IDs."""
        # 1. Functional road hierarchy score (1 = highest, 5 = lowest)
        hierarchy_map = {
            RoadClass.MOTORWAY: 1,
            RoadClass.HIGHWAY: 1,
            RoadClass.ARTERIAL: 2,
            RoadClass.COLLECTOR: 3,
            RoadClass.LOCAL: 4,
            RoadClass.SERVICE: 5,
            RoadClass.PEDESTRIAN: 5,
            RoadClass.CYCLEWAY: 5,
            RoadClass.PATH: 5,
            RoadClass.TRACK: 5,
            RoadClass.ALLEY: 5,
            RoadClass.UNKNOWN: 5,
        }
        self.roads["functional_hierarchy"] = self.roads["road_class"].map(hierarchy_map)

        # 2. Build connectivity graph to find continuous corridors
        G = nx.Graph()
        for idx, row in self.roads.iterrows():
            G.add_node(idx, name=row.get("name"), road_class=row["road_class"])

        # Link touching edges if they share name and class
        # Build spatial node-to-edges mapping
        node_to_edges = {}
        for idx, row in self.roads.iterrows():
            u, v = row["start_node"], row["end_node"]
            for node in [u, v]:
                if node not in node_to_edges:
                    node_to_edges[node] = []
                node_to_edges[node].append(idx)

        for node, edges in node_to_edges.items():
            if len(edges) < 2:
                continue
            for i in range(len(edges)):
                for j in range(i + 1, len(edges)):
                    e1, e2 = edges[i], edges[j]
                    row1, row2 = self.roads.loc[e1], self.roads.loc[e2]
                    
                    name1, name2 = row1.get("name"), row2.get("name")
                    class1, class2 = row1["road_class"], row2["road_class"]

                    # Share names and class, link them as continuous corridor
                    names_match = (
                        (name1 and name2 and name1 == name2) or 
                        ((not name1 or name1 == "") and (not name2 or name2 == ""))
                    )
                    if names_match and class1 == class2:
                        G.add_edge(e1, e2)

        # Assign Corridor IDs and compute stats
        corridor_ids = {}
        corridor_lengths = {}
        corridor_index = 0

        for comp in nx.connected_components(G):
            # Generate corridor ID
            sample_edge = list(comp)[0]
            name = self.roads.loc[sample_edge].get("name")
            corr_id = generate_corridor_id(name, corridor_index)
            corridor_index += 1

            # Sum lengths
            total_len = sum(self.roads.loc[e].geometry.length for e in comp)

            for e in comp:
                corridor_ids[e] = corr_id
                corridor_lengths[e] = total_len

        self.roads["tf_corridor_id"] = self.roads.index.map(corridor_ids)
        self.roads["corridor_length_m"] = self.roads.index.map(corridor_lengths)
