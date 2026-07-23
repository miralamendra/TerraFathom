"""Module 5: Network Distribution Analysis.

Generates the standard plots used in urban network science:

* Degree histogram
* Complementary cumulative degree distribution (CCDF)
* Log-log degree / frequency plot
* Power-law fit (Clauset et al. style KS-distance minimisation)
"""

from __future__ import annotations

import math
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

import networkx as nx

from .base import BaseAnalyzer, to_undirected


class DistributionAnalyzer(BaseAnalyzer):
    name = "distribution"

    def compute(self, graph: nx.MultiDiGraph) -> Dict[str, Any]:
        g = to_undirected(graph)
        n = g.number_of_nodes()
        if n == 0:
            return {
                "histogram": [],
                "ccdf": [],
                "ccdf_loglog": [],
                "power_law": None,
                "moments": {},
                "network_type": {
                    "is_scale_free": False,
                    "is_small_world": False,
                    "is_random": False,
                    "is_regular": False,
                },
            }

        degrees = [int(d) for _, d in g.degree()]
        counter = Counter(degrees)
        total = sum(counter.values())

        # --- Histogram (degree vs count) ---
        histogram = [
            {"degree": deg, "count": cnt} for deg, cnt in sorted(counter.items())
        ]

        # --- CCDF and log-log arrays ---
        sorted_degs = sorted(counter.items())
        ccdf_payload: List[Dict[str, float]] = []
        ccdf_loglog: List[Dict[str, float]] = []
        cum = 0
        for deg, cnt in sorted_degs:
            cum += cnt
            p_ge = (total - cum) / total
            ccdf_payload.append({"degree": int(deg), "ccdf": float(p_ge)})
            if deg > 0 and p_ge > 0:
                ccdf_loglog.append(
                    {"log_degree": math.log(deg), "log_ccdf": math.log(p_ge)}
                )

        # --- Power law fit ---
        power_law = _fit_power_law(ccdf_payload, degrees)

        # --- Moments ---
        mean = sum(degrees) / n
        var = sum((d - mean) ** 2 for d in degrees) / n
        std = math.sqrt(var)
        moments = {
            "mean": mean,
            "variance": var,
            "std": std,
            "skewness": _central_moment(degrees, 3, mean, std),
            "kurtosis": _central_moment(degrees, 4, mean, std),
        }

        # --- Heuristic network classification ---
        try:
            clustering = nx.average_clustering(g)
        except Exception:
            clustering = 0.0
        try:
            components = list(nx.connected_components(g))
            largest = max((len(c) for c in components), default=0)
            if largest > 1:
                avg_path = nx.average_shortest_path_length(
                    g.subgraph(next(c for c in components if len(c) == largest))
                )
            else:
                avg_path = 0.0
        except Exception:
            avg_path = float("inf")

        network_type = {
            "is_scale_free": bool(
                power_law
                and power_law.get("goodness_of_fit", 0) > 0.8
                and 2.0 <= power_law.get("alpha", 0) <= 4.0
            ),
            "is_small_world": bool(clustering > 0.1 and avg_path < 10),
            "is_random": bool(abs(moments["skewness"]) < 0.5 and clustering < 0.1),
            "is_regular": bool(std < 0.5),
        }

        return {
            "histogram": histogram,
            "ccdf": ccdf_payload,
            "ccdf_loglog": ccdf_loglog,
            "power_law": power_law,
            "moments": moments,
            "network_type": network_type,
        }


# ---------------------------------------------------------------------- #
# Power law fit
# ---------------------------------------------------------------------- #
def _fit_power_law(
    ccdf: List[Dict[str, float]], degrees: List[int]
) -> Optional[Dict[str, Any]]:
    """Continuous power-law fit using MLE and KS-distance minimisation."""
    if len(ccdf) < 3:
        return None

    unique_degrees = sorted(list(set(degrees)))
    
    best: Optional[Dict[str, Any]] = None
    for xmin in unique_degrees[:-2]:
        tail_degrees = [d for d in degrees if d >= xmin]
        n_tail = len(tail_degrees)
        if n_tail < 3:
            continue
            
        alpha = _mle_alpha(tail_degrees, xmin)
        if alpha <= 1.0 or alpha > 10.0:
            continue
            
        ks_data = []
        for k in unique_degrees:
            if k >= xmin:
                count_ge = sum(1 for d in tail_degrees if d >= k)
                ks_data.append((k, count_ge / n_tail))
                
        ks_distance = _ks_distance(ks_data, alpha, xmin)
        score = 1.0 - ks_distance
        if best is None or score > best["goodness_of_fit"]:
            best = {
                "alpha": float(alpha),
                "xmin": int(xmin),
                "goodness_of_fit": float(score),
                "ks_distance": float(ks_distance),
            }

    return best


def _mle_alpha(tail_degrees: List[int], xmin: int) -> float:
    n = len(tail_degrees)
    if n == 0 or xmin <= 0:
        return 1.0
    s = sum(math.log(d / xmin) for d in tail_degrees)
    if s <= 0:
        return 1.0
    return 1.0 + n / s


def _ks_distance(ks_data: List[Tuple[int, float]], alpha: float, xmin: int) -> float:
    if not ks_data:
        return 1.0
    max_d = 0.0
    for k, empirical in ks_data:
        if k <= 0:
            continue
        theoretical = (k / xmin) ** (1.0 - alpha)
        max_d = max(max_d, abs(theoretical - empirical))
    return max_d


def _central_moment(values: List[float], k: int, mean: float, std: float) -> float:
    if std == 0 or not values:
        return 0.0
    n = len(values)
    return sum(((v - mean) / std) ** k for v in values) / n
