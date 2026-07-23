"""Module 6: Community Detection.

Implements three community-detection algorithms:

* **Louvain** – greedy modularity optimisation (NetworkX).
* **Leiden** – refinement of Louvain. Falls back to Louvain.
* **Girvan–Newman** – edge betweenness based divisive method.
"""

from __future__ import annotations

import logging
from collections import Counter
from typing import Any, Dict, List, Optional

import networkx as nx

from .base import BaseAnalyzer, to_undirected

logger = logging.getLogger(__name__)


SUPPORTED_ALGORITHMS: List[str] = ["louvain", "leiden", "girvan_newman"]


class CommunityDetectionAnalyzer(BaseAnalyzer):
    name = "community"

    def __init__(
        self,
        algorithm: str = "louvain",
        resolution: float = 1.0,
        max_communities: int = 50,
    ) -> None:
        if algorithm not in SUPPORTED_ALGORITHMS:
            raise ValueError(
                f"Unknown community algorithm '{algorithm}'. "
                f"Supported: {SUPPORTED_ALGORITHMS}"
            )
        self.algorithm = algorithm
        self.resolution = resolution
        self.max_communities = max_communities

    def compute(self, graph: nx.MultiDiGraph) -> Dict[str, Any]:
        g = to_undirected(graph)
        n = g.number_of_nodes()
        if n == 0:
            return self._empty_result()

        if self.algorithm == "louvain":
            partition = self._louvain(g)
        elif self.algorithm == "leiden":
            partition = self._leiden(g)
        else:  # girvan_newman
            partition = self._girvan_newman(g)

        sizes = Counter(partition.values())
        community_sizes = [
            {"community_id": int(cid), "size": int(size)}
            for cid, size in sorted(sizes.items())
        ]

        # Modularity via NetworkX (works on the partition we computed).
        try:
            communities_sets = [set() for _ in range(max(sizes.keys()) + 1)]
            for node, cid in partition.items():
                communities_sets[cid].add(node)
            modularity = nx.community.modularity(g, communities_sets)
        except Exception:
            modularity = 0.0

        # Coverage: fraction of nodes that belong to the partition
        coverage = sum(sizes.values()) / n

        # Performance: fraction of edges within communities
        within = 0
        for u, v in g.edges():
            if partition.get(u) == partition.get(v):
                within += 1
        performance = within / g.number_of_edges() if g.number_of_edges() else 0.0

        # Per-node assignments for the front-end map
        node_assignments = [
            {"node_id": str(node), "community_id": int(cid)}
            for node, cid in partition.items()
        ]

        # Re-index communities so they are zero-based and contiguous.
        remap = {old: new for new, old in enumerate(sorted(sizes.keys()))}
        node_assignments = [
            {"node_id": a["node_id"], "community_id": remap[a["community_id"]]}
            for a in node_assignments
        ]
        community_sizes = [
            {"community_id": remap[c["community_id"]], "size": c["size"]}
            for c in community_sizes
        ]

        return {
            "algorithm": self.algorithm,
            "modularity": float(modularity),
            "community_count": len(community_sizes),
            "community_sizes": community_sizes,
            "node_assignments": node_assignments,
            "statistics": {
                "modularity": float(modularity),
                "coverage": float(coverage),
                "performance": float(performance),
                "average_size": (
                    float(sum(s["size"] for s in community_sizes) / len(community_sizes))
                    if community_sizes
                    else 0.0
                ),
                "max_size": max((s["size"] for s in community_sizes), default=0),
                "min_size": min((s["size"] for s in community_sizes), default=0),
            },
        }

    # ------------------------------------------------------------------ #
    # Algorithms
    # ------------------------------------------------------------------ #
    def _louvain(self, g: nx.Graph) -> Dict[Any, int]:
        try:
            from networkx.algorithms.community import louvain_communities

            communities = louvain_communities(
                g, resolution=self.resolution, seed=42
            )
        except Exception as exc:
            logger.warning("Louvain failed (%s); using greedy modularity.", exc)
            from networkx.algorithms.community import greedy_modularity_communities

            communities = greedy_modularity_communities(g)
        partition: Dict[Any, int] = {}
        for cid, comm in enumerate(communities):
            for node in comm:
                partition[node] = cid
        return partition

    def _leiden(self, g: nx.Graph) -> Dict[Any, int]:
        try:
            import igraph as ig
            import leidenalg as la

            mapping = {node: i for i, node in enumerate(g.nodes())}
            edges = [(mapping[u], mapping[v]) for u, v in g.edges()]
            ig_graph = ig.Graph(n=len(mapping), edges=edges, directed=False)
            partition = la.find_partition(
                ig_graph,
                la.CPMVertexPartition,
                weights=None,
                resolution_parameter=self.resolution,
            )
            result: Dict[Any, int] = {}
            for cid, comm in enumerate(partition):
                for idx in comm:
                    inv_node = next(n for n, i in mapping.items() if i == idx)
                    result[inv_node] = cid
            return result
        except Exception as exc:
            logger.warning("Leiden failed (%s); falling back to Louvain.", exc)
            return self._louvain(g)

    def _girvan_newman(self, g: nx.Graph) -> Dict[Any, int]:
        try:
            from networkx.algorithms.community import girvan_newman
        except Exception:
            return self._louvain(g)
        # Number of communities to find is capped for tractability.
        target = min(self.max_communities, max(2, g.number_of_nodes() // 50))
        try:
            communities_iter = girvan_newman(g)
            best_level = None
            best_modularity = -float("inf")
            for level in range(target):
                try:
                    level_communities = next(communities_iter)
                except StopIteration:
                    break
                try:
                    mod = nx.community.modularity(g, level_communities)
                except Exception:
                    mod = 0.0
                if mod > best_modularity:
                    best_modularity = mod
                    best_level = level_communities
            if best_level is None:
                return self._louvain(g)
            partition = {}
            for cid, comm in enumerate(best_level):
                for node in comm:
                    partition[node] = cid
            return partition
        except Exception as exc:
            logger.warning("Girvan-Newman failed (%s); falling back to Louvain.", exc)
            return self._louvain(g)

    @staticmethod
    def _empty_result() -> Dict[str, Any]:
        return {
            "algorithm": "louvain",
            "modularity": 0.0,
            "community_count": 0,
            "community_sizes": [],
            "node_assignments": [],
            "statistics": {
                "modularity": 0.0,
                "coverage": 0.0,
                "performance": 0.0,
                "average_size": 0.0,
                "max_size": 0,
                "min_size": 0,
            },
        }
