"""
Dangling Node Detector.

Identifies degree-one endpoints (dead ends) in the network that are potential
candidates for connectivity repair, distinguishing them from boundary-created dangles
or genuine cul-de-sacs.
"""

from __future__ import annotations

import logging
import geopandas as gpd
from shapely.geometry import Point, Polygon

logger = logging.getLogger("urban_engine.cleaning.dangle_detector")


class DangleCandidate:
    """Represents a degree-one node candidate for connectivity repair."""

    def __init__(
        self,
        node_id: str,
        coordinate: tuple[float, float],
        connected_edge_id: Any,
        is_start: bool,
        is_boundary: bool = False,
    ) -> None:
        self.node_id = node_id
        self.coordinate = coordinate
        self.connected_edge_id = connected_edge_id
        self.is_start = is_start
        self.is_boundary = is_boundary

    def to_dict(self) -> dict:
        return {
            "node_id": self.node_id,
            "coordinate": self.coordinate,
            "connected_edge_id": self.connected_edge_id,
            "is_start": self.is_start,
            "is_boundary": self.is_boundary,
        }


def detect_dangles(
    roads_gdf: gpd.GeoDataFrame,
    nodes_gdf: gpd.GeoDataFrame,
    boundary_geom: Polygon | None = None,
    boundary_buffer_m: float = 10.0,
) -> list[DangleCandidate]:
    """
    Scan the network and return a list of DangleCandidate objects.
    - Excludes nodes that connect to more than 1 edge.
    - Flags nodes that are near the study area boundary.
    """
    if roads_gdf.empty or nodes_gdf.empty:
        return []

    # 1. Count incident edges for each node
    node_degrees: dict[str, int] = {}
    node_to_edge: dict[str, list[tuple[str, bool]]] = {}  # node_id -> list of (edge_id, is_start)

    for idx, row in roads_gdf.iterrows():
        start_node = row.get("start_node")
        end_node = row.get("end_node")

        if start_node:
            node_degrees[start_node] = node_degrees.get(start_node, 0) + 1
            node_to_edge.setdefault(start_node, []).append((idx, True))
        if end_node:
            node_degrees[end_node] = node_degrees.get(end_node, 0) + 1
            node_to_edge.setdefault(end_node, []).append((idx, False))

    candidates: list[DangleCandidate] = []

    # 2. Find degree-one nodes
    for node_id, degree in node_degrees.items():
        if degree != 1:
            continue

        # Get node coordinates
        if node_id not in nodes_gdf.index:
            continue

        node_row = nodes_gdf.loc[node_id]
        x, y = node_row["x"], node_row["y"]
        pt = Point(x, y)

        # Determine if it's near the boundary
        is_boundary = False
        if boundary_geom is not None:
            # Check if point is very close to boundary line
            try:
                dist = pt.distance(boundary_geom.boundary)
                if dist <= boundary_buffer_m:
                    is_boundary = True
            except Exception:
                pass

        edge_info = node_to_edge[node_id][0]
        connected_edge_id, is_start = edge_info

        candidates.append(
            DangleCandidate(
                node_id=node_id,
                coordinate=(x, y),
                connected_edge_id=connected_edge_id,
                is_start=is_start,
                is_boundary=is_boundary,
            )
        )

    logger.info(
        "Dangle detection complete: found %d degree-one endpoints (%d flagged as boundary dangles)",
        len(candidates),
        sum(1 for c in candidates if c.is_boundary),
    )

    return candidates
