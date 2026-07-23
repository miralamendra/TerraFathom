"""
Multi-Graph Builder.

Constructs 5 different network graph representations for downstream plugins:
Physical Graph (undirected), Directed Graph, Pedestrian Graph, Vehicle Graph,
and the Space Syntax Dual Graph (segments as vertices).
"""

from __future__ import annotations

import logging
from typing import Any, Dict

import geopandas as gpd
import networkx as nx

from urban_engine.road_classes import RoadClass

logger = logging.getLogger("urban_engine.graph.graph_builder")


class GraphBuilder:
    """Builds and manages multiple graph representations of the urban network."""

    def __init__(self, segments_gdf: gpd.GeoDataFrame, nodes_gdf: gpd.GeoDataFrame) -> None:
        self.segments = segments_gdf
        self.nodes = nodes_gdf

    def build_physical_graph(self) -> nx.MultiGraph:
        """Build undirected physical multigraph."""
        g = nx.MultiGraph()
        for idx, row in self.segments.iterrows():
            g.add_edge(
                row["start_node"],
                row["end_node"],
                key=idx,
                weight=row["geometry"].length,
                road_class=row["road_class"],
                speed_kmh=row["speed_kmh"],
            )
        return g

    def build_directed_graph(self) -> nx.MultiDiGraph:
        """Build directed multigraph respecting oneway directions."""
        g = nx.MultiDiGraph()
        for idx, row in self.segments.iterrows():
            geom = row["geometry"]
            oneway = row.get("oneway")
            
            # Determine direction of travel
            is_oneway = False
            reverse = False
            
            if oneway in ("yes", "1", "true"):
                is_oneway = True
            elif oneway in ("-1", "reverse"):
                is_oneway = True
                reverse = True

            weight = geom.length
            attrs = {
                "weight": weight,
                "road_class": row["road_class"],
                "speed_kmh": row["speed_kmh"],
                "lanes": row["lanes"],
            }

            if not is_oneway:
                # Add both directions
                g.add_edge(row["start_node"], row["end_node"], key=idx, **attrs)
                g.add_edge(row["end_node"], row["start_node"], key=idx, **attrs)
            elif reverse:
                g.add_edge(row["end_node"], row["start_node"], key=idx, **attrs)
            else:
                g.add_edge(row["start_node"], row["end_node"], key=idx, **attrs)

        return g

    def build_pedestrian_graph(self, directed_g: nx.MultiDiGraph) -> nx.MultiDiGraph:
        """Build pedestrian-accessible subgraph (filters out highways/motorways)."""
        ped_g = nx.MultiDiGraph()
        excluded_classes = {RoadClass.MOTORWAY, RoadClass.HIGHWAY}
        
        for u, v, key, data in directed_g.edges(keys=True, data=True):
            r_class = data.get("road_class")
            if r_class not in excluded_classes:
                ped_g.add_edge(u, v, key=key, **data)
                
        return ped_g

    def build_vehicle_graph(self, directed_g: nx.MultiDiGraph) -> nx.MultiDiGraph:
        """Build vehicle-accessible subgraph (filters out pedestrian-only paths)."""
        veh_g = nx.MultiDiGraph()
        excluded_classes = {RoadClass.PEDESTRIAN, RoadClass.STEPS, RoadClass.PATH}
        
        for u, v, key, data in directed_g.edges(keys=True, data=True):
            r_class = data.get("road_class")
            if r_class not in excluded_classes:
                veh_g.add_edge(u, v, key=key, **data)
                
        return veh_g

