"""Base class and shared helpers for TerraFathom analyzers."""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import Any, Dict

import networkx as nx


# ---------------------------------------------------------------------- #
# Exceptions
# ---------------------------------------------------------------------- #
class AnalysisError(Exception):
    """Raised by an analyzer when it cannot complete its computation."""


# ---------------------------------------------------------------------- #
# Base analyzer
# ---------------------------------------------------------------------- #
class BaseAnalyzer(ABC):
    """Abstract base class for all analyzers.

    Subclasses implement :meth:`compute` and return a plain JSON-friendly
    ``dict``.  The dictionary is then cached in the DB/Store and
    served by the API.
    """

    #: Short identifier used in API responses and cache keys.
    name: str = "base"

    @abstractmethod
    def compute(self, graph: nx.MultiDiGraph) -> Dict[str, Any]:
        """Run the analysis and return a JSON-serialisable result."""

    # ------------------------------------------------------------------ #
    # Convenience
    # ------------------------------------------------------------------ #
    def timed(self, graph: nx.MultiDiGraph) -> Dict[str, Any]:
        """Run :meth:`compute` and wrap the result in a metadata envelope."""
        start = time.time()
        result = self.compute(graph)
        result.setdefault("metadata", {})
        result["metadata"].update(
            {
                "analyzer": self.name,
                "computation_time": time.time() - start,
                "node_count": int(graph.number_of_nodes()),
                "edge_count": int(graph.number_of_edges()),
            }
        )
        return result


# ---------------------------------------------------------------------- #
# Graph helpers
# ---------------------------------------------------------------------- #
def to_undirected(graph: nx.MultiDiGraph) -> nx.Graph:
    """Return a simple undirected view of the graph for analysis.

    Parallel edges are collapsed using ``to_undirected`` which sums
    edge attributes.  For the metrics computed in this package the
    exact aggregation rule is unimportant because we use the simple
    unweighted / shortest-path semantics.
    """
    if graph.is_directed():
        return nx.Graph(graph)
    return graph
