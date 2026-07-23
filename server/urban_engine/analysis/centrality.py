"""Module 4: Centrality Analysis.

Computes the full set of node and edge centralities:

* Degree centrality
* Betweenness centrality (node and edge)
* Closeness centrality
* Eigenvector centrality
* PageRank
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Tuple

import networkx as nx

from .base import BaseAnalyzer, to_undirected


SUPPORTED_METRICS: Tuple[str, ...] = (
    "degree",
    "betweenness",
    "closeness",
    "eigenvector",
    "pagerank",
    "edge_betweenness",
)


class CentralityAnalyzer(BaseAnalyzer):
    name = "centrality"

    def __init__(self, metric: str = "degree", top_n: int = 20) -> None:
        if metric not in SUPPORTED_METRICS:
            raise ValueError(
                f"Unknown centrality metric '{metric}'. "
                f"Supported: {list(SUPPORTED_METRICS)}"
            )
        self.metric = metric
        self.top_n = top_n

    def compute(self, graph: nx.MultiDiGraph) -> Dict[str, Any]:
        g = to_undirected(graph)
        n = g.number_of_nodes()
        if n == 0:
            return {
                "metric": self.metric,
                "ranking": [],
                "distribution": {"values": [], "histogram": []},
                "summary": {},
            }

        values = self._compute_metric(g)

        if self.metric == "edge_betweenness":
            ranking = sorted(
                (
                    {
                        "edge_id": key,
                        "source": u,
                        "target": v,
                        "value": float(score),
                    }
                    for (u, v, key), score in values.items()
                ),
                key=lambda r: r["value"],
                reverse=True,
            )[: self.top_n]
        else:
            ranking = sorted(
                (
                    {"node_id": node, "value": float(score)}
                    for node, score in values.items()
                ),
                key=lambda r: r["value"],
                reverse=True,
            )[: self.top_n]

        flat = [float(v) for v in values.values()]
        flat.sort()
        histogram = _histogram(flat, bins=24)

        if not flat:
            summary = {
                "mean": 0.0,
                "min": 0.0,
                "max": 0.0,
                "std": 0.0,
            }
        else:
            summary = {
                "mean": sum(flat) / len(flat),
                "min": min(flat),
                "max": max(flat),
                "std": _std(flat),
            }

        return {
            "metric": self.metric,
            "ranking": ranking,
            "distribution": {"values": flat, "histogram": histogram},
            "summary": summary,
            # Full scores dict for frontend layer injection (avoids re-computation)
            "scores": (
                {str(edge_key): float(score) for (src, tgt, edge_key), score in values.items()}
                if self.metric == "edge_betweenness"
                else {str(node): float(score) for node, score in values.items()}
            ),
        }

    # ------------------------------------------------------------------ #
    # Per-metric computation
    # ------------------------------------------------------------------ #
    def _compute_metric(self, graph: nx.Graph) -> Dict[Any, float]:
        metric = self.metric
        n = graph.number_of_nodes()
        if metric == "degree":
            return {node: float(deg) for node, deg in graph.degree()}
        if metric == "betweenness":
            k = min(n, 200) if n > 200 else None
            return nx.betweenness_centrality(graph, k=k, normalized=True)
        if metric == "closeness":
            if n > 500:
                # Eppstein-Wang style approximation for closeness centrality
                import random
                k = min(n, 100)
                pivot_nodes = random.sample(list(graph.nodes()), k)
                
                # Compute BFS distance from each pivot node to all other nodes
                dist_sum = {node: 0.0 for node in graph.nodes()}
                reach_count = {node: 0 for node in graph.nodes()}
                
                for pivot in pivot_nodes:
                    # Run single source shortest path (BFS since it is unweighted)
                    dists = nx.single_source_shortest_path_length(graph, pivot)
                    for node, d in dists.items():
                        dist_sum[node] += d
                        reach_count[node] += 1
                
                scores = {}
                for node in graph.nodes():
                    rc = reach_count[node]
                    if rc > 0:
                        avg_dist = dist_sum[node] / rc
                        scores[node] = 1.0 / avg_dist if avg_dist > 0 else 0.0
                    else:
                        scores[node] = 0.0
                return scores
            else:
                return nx.closeness_centrality(graph)
        if metric == "eigenvector":
            try:
                return nx.eigenvector_centrality_numpy(graph)
            except Exception:
                try:
                    return nx.eigenvector_centrality(graph, max_iter=1000)
                except Exception:
                    return {n: 0.0 for n in graph.nodes()}
        if metric == "pagerank":
            return nx.pagerank(graph, alpha=0.85)
        if metric == "edge_betweenness":
            k = min(n, 50) if n > 50 else None
            return {
                (u, v, k_id): score
                for (u, v, k_id), score in nx.edge_betweenness_centrality(
                    graph, k=k, normalized=True
                ).items()
            }
        raise ValueError(f"Unsupported metric: {metric}")


def _histogram(values: List[float], bins: int = 20) -> List[Dict[str, float]]:
    if not values:
        return []
    lo, hi = min(values), max(values)
    if lo == hi:
        return [{"bin_start": float(lo), "bin_end": float(hi), "count": float(len(values))}]
    step = (hi - lo) / bins
    edges = [lo + i * step for i in range(bins + 1)]
    counts = [0] * bins
    for v in values:
        idx = min(int((v - lo) / step), bins - 1)
        counts[idx] += 1
    return [
        {"bin_start": edges[i], "bin_end": edges[i + 1], "count": float(counts[i])}
        for i in range(bins)
    ]


def _std(values: List[float]) -> float:
    if not values:
        return 0.0
    mean = sum(values) / len(values)
    var = sum((v - mean) ** 2 for v in values) / len(values)
    return math.sqrt(var)
