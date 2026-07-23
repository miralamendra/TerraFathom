from __future__ import annotations

import logging
import geopandas as gpd
import networkx as nx
from typing import Dict, Any, List

logger = logging.getLogger("urban_engine.validation.connectivity")

class ConnectivityVerifier:
    """
    Performs topological reachability, dead-end, circular, and isolated component audits
    to verify network integrity post-repair.
    """

    def __init__(self, roads_gdf: gpd.GeoDataFrame, nodes_gdf: gpd.GeoDataFrame) -> None:
        self.roads = roads_gdf
        self.nodes = nodes_gdf

    def verify(self) -> Dict[str, Any]:
        """
        Runs reachability checks. Returns a detailed connectivity report.
        """
        logger.info("Running post-repair Connectivity Verification...")
        
        report = {
            "total_components": 1,
            "largest_component_pct": 100.0,
            "isolated_islands_count": 0,
            "dead_ends_count": 0,
            "circular_loops_count": 0,
            "disconnected_edge_ids": [],
            "dead_end_node_ids": []
        }

        if self.roads.empty or self.nodes.empty:
            return report

        # Build networkx graph
        G = nx.Graph()
        for idx, row in self.roads.iterrows():
            u, v = row["start_node"], row["end_node"]
            G.add_edge(u, v, id=idx)

        # 1. Component Auditing
        components = list(nx.connected_components(G))
        total_nodes = len(self.nodes)
        
        if components and total_nodes > 0:
            report["total_components"] = len(components)
            largest_comp = max(components, key=len)
            report["largest_component_pct"] = round((len(largest_comp) / total_nodes) * 100.0, 1)

            # Islands (smaller disconnected subgraphs)
            islands = [c for c in components if c != largest_comp]
            report["isolated_islands_count"] = len(islands)

            # Gather edge IDs belonging to isolated components
            disconnected_edges = []
            for island in islands:
                for u, v in G.edges(island):
                    edge_id = G[u][v]["id"]
                    disconnected_edges.append(str(edge_id))
            report["disconnected_edge_ids"] = disconnected_edges[:100]  # Cap display

        # 2. Dead-End Auditing (degree-1 nodes)
        dead_ends = [node for node, deg in G.degree() if deg == 1]
        report["dead_ends_count"] = len(dead_ends)
        report["dead_end_node_ids"] = [str(n) for n in dead_ends[:100]]

        # 3. Circular Loop Auditing (cycles without outgoing connections)
        try:
            cycles = nx.cycle_basis(G)
            circular_loops = 0
            for cycle in cycles:
                # A cycle is a standalone loop if all its nodes have degree 2
                is_isolated_loop = all(G.degree(node) == 2 for node in cycle)
                if is_isolated_loop:
                    circular_loops += 1
            report["circular_loops_count"] = circular_loops
        except Exception as e:
            logger.error("Failed to compute cycles: %s", e)

        logger.info(
            "Connectivity audit finished: %d components (largest: %.1f%%), %d dead-ends, %d loops",
            report["total_components"],
            report["largest_component_pct"],
            report["dead_ends_count"],
            report["circular_loops_count"]
        )

        return report
