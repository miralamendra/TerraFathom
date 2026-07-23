"""
Endpoint Connectivity Scorer.

Implements multi-signal scoring for dangling node snap candidates:
- Measure endpoint-to-target distance.
- Measure approach direction and collinearity.
- Compare road classes, names, and vertical levels.
- Apply distance-tiered confidence policy.
"""

from __future__ import annotations

import logging
import numpy as np
from shapely.geometry import Point, LineString
from shapely.ops import nearest_points
import geopandas as gpd

from urban_engine.spatial_index import SpatialIndexEngine
from urban_engine.road_classes import RoadClass

logger = logging.getLogger("urban_engine.cleaning.endpoint_scorer")


class EndpointConnectionCandidate:
    """Represents a potential connection from a dangling node to a target road."""

    def __init__(
        self,
        dangle_node_id: str,
        source_edge_id: str,
        target_edge_id: str,
        distance: float,
        snap_point: tuple[float, float],
        confidence: float,
        action: str,  # "auto_repair", "manual_review", "preserve"
        explanation: str,
    ) -> None:
        self.dangle_node_id = dangle_node_id
        self.source_edge_id = source_edge_id
        self.target_edge_id = target_edge_id
        self.distance = distance
        self.snap_point = snap_point
        self.confidence = confidence
        self.action = action
        self.explanation = explanation

    def to_dict(self) -> dict:
        return {
            "dangle_node_id": self.dangle_node_id,
            "source_edge_id": self.source_edge_id,
            "target_edge_id": self.target_edge_id,
            "distance": self.distance,
            "snap_point": self.snap_point,
            "confidence": self.confidence,
            "action": self.action,
            "explanation": self.explanation,
        }


def score_dangle_connections(
    dangles: list[DangleCandidate],
    roads_gdf: gpd.GeoDataFrame,
    max_search_dist: float = 12.0,
) -> list[EndpointConnectionCandidate]:
    """
    Score all dangling endpoints and return candidate connections.
    """
    if not dangles or roads_gdf.empty:
        return []

    idx_engine = SpatialIndexEngine.from_geodataframe(roads_gdf)
    candidates: list[EndpointConnectionCandidate] = []

    for d in dangles:
        # Get source road details
        edge_id = d.connected_edge_id
        if edge_id not in roads_gdf.index:
            try:
                edge_id_int = int(edge_id)
                if edge_id_int in roads_gdf.index:
                    edge_id = edge_id_int
            except ValueError:
                pass

        if edge_id not in roads_gdf.index:
            continue

        source_row = roads_gdf.loc[edge_id]
        source_geom = source_row.geometry
        source_coords = list(source_geom.coords)
        source_class = source_row.get("road_class")
        source_name = source_row.get("name")
        source_level = source_row.get("level")
        source_layer = source_row.get("layer", 0)

        # Get approach vector (direction pointing OUT from the dead end)
        dangle_pt = Point(d.coordinate)
        if d.is_start:
            # Out from start node means coords[0] to coords[1] reversed
            approach_vector = np.array([source_coords[0][0] - source_coords[1][0],
                                        source_coords[0][1] - source_coords[1][1]])
        else:
            # Out from end node means coords[-1] to coords[-2] reversed
            approach_vector = np.array([source_coords[-1][0] - source_coords[-2][0],
                                        source_coords[-1][1] - source_coords[-2][1]])

        norm = np.linalg.norm(approach_vector)
        if norm > 0:
            approach_vector = approach_vector / norm
        else:
            approach_vector = np.array([0.0, 0.0])

        # Query candidates within max search distance
        nearby_edge_ids = idx_engine.query_within_distance(dangle_pt, max_search_dist)
        
        for target_id in nearby_edge_ids:
            if str(target_id) == str(d.connected_edge_id):
                continue

            target_row = roads_gdf.loc[target_id]
            target_geom = target_row.geometry
            
            # Find closest projection point on target segment
            proj_dist = target_geom.project(dangle_pt)
            proj_pt = target_geom.interpolate(proj_dist)
            
            dist = dangle_pt.distance(proj_pt)
            if dist < 0.01 or dist > max_search_dist:
                # Exclude if it's already touching or too far
                continue

            # 1. Compare bridge, tunnel, level, layer (Grade Separation Check)
            if target_row.get("layer", 0) != source_layer:
                continue
            if target_row.get("bridge") != source_row.get("bridge") or \
               target_row.get("tunnel") != source_row.get("tunnel"):
                continue

            # 2. Compare road classes
            target_class = target_row.get("road_class")
            # Motorways/highways shouldn't be snapped to unless they are ramps or same class
            if target_class in (RoadClass.MOTORWAY, RoadClass.HIGHWAY) and \
               source_class not in (RoadClass.MOTORWAY, RoadClass.HIGHWAY):
                continue

            # 3. Calculate directionality (alignment angle)
            conn_vector = np.array([proj_pt.x - dangle_pt.x, proj_pt.y - dangle_pt.y])
            conn_norm = np.linalg.norm(conn_vector)
            if conn_norm > 0:
                conn_vector = conn_vector / conn_norm
            else:
                conn_vector = np.array([0.0, 0.0])

            # Dot product to check collinearity
            dot_product = float(np.clip(np.dot(approach_vector, conn_vector), -1.0, 1.0))
            alignment_angle_deg = float(np.degrees(np.arccos(dot_product)))

            # If angle is large, the segment is pointing away from the target!
            # E.g., it is a T-junction or cul-de-sac pointing backward.
            # Angle near 0 means continuation of the road line.
            
            # 4. Check if we are snapping to a parallel segment (Section 10 "parallel negative evidence")
            target_coords = list(target_geom.coords)
            target_vector = np.array([target_coords[-1][0] - target_coords[0][0],
                                      target_coords[-1][1] - target_coords[0][1]])
            target_norm = np.linalg.norm(target_vector)
            if target_norm > 0:
                target_vector = target_vector / target_norm
            else:
                target_vector = np.array([0.0, 0.0])
                
            cross_prod = abs(np.cross(approach_vector, target_vector))
            # If cross_prod is near 0, they are parallel (approaching along same path)
            is_parallel = cross_prod < 0.15

            # 5. Multi-signal scoring calculation
            score = 100.0
            explanation_parts = []

            # Penalty for distance
            score -= dist * 4.0
            explanation_parts.append(f"dist={dist:.1f}m")

            # Penalty/Bonus for alignment angle
            if alignment_angle_deg < 30.0:
                score += 15.0  # Pointing directly towards it
                explanation_parts.append("strong alignment")
            elif alignment_angle_deg > 90.0:
                score -= 40.0  # Pointing away
                explanation_parts.append("pointing away")
            else:
                score -= (alignment_angle_deg - 30.0) * 0.5

            # Bonus for matching names
            target_name = target_row.get("name")
            if source_name and target_name and source_name == target_name:
                score += 20.0
                explanation_parts.append("names match")

            # Penalty for parallel segments
            if is_parallel:
                score -= 30.0
                explanation_parts.append("parallel negative evidence")

            # Penalty for boundary dangles
            if d.is_boundary:
                score -= 20.0
                explanation_parts.append("boundary dangle")

            # Clamp score between 0 and 100
            score = float(np.clip(score, 0.0, 100.0))

            # 6. Apply Distance-Tiered Action Policy
            if dist < 1.0:
                action = "auto_repair"
                confidence = max(score, 90.0)  # Always high confidence for tiny gap
            elif 1.0 <= dist <= 3.0:
                # Only auto if alignment is strong
                if alignment_angle_deg < 45.0 and not is_parallel:
                    action = "auto_repair"
                    confidence = score
                else:
                    action = "manual_review"
                    confidence = score
            elif 3.0 < dist <= 10.0:
                action = "manual_review"
                confidence = score
            else:  # > 10.0m
                action = "preserve"
                confidence = score

            explanation = ", ".join(explanation_parts)

            candidates.append(
                EndpointConnectionCandidate(
                    dangle_node_id=d.node_id,
                    source_edge_id=d.connected_edge_id,
                    target_edge_id=target_id,
                    distance=dist,
                    snap_point=(proj_pt.x, proj_pt.y),
                    confidence=confidence,
                    action=action,
                    explanation=f"Scored: {explanation} (angle={alignment_angle_deg:.1f}°)",
                )
            )

    # Sort candidates by confidence descending
    candidates.sort(key=lambda x: x.confidence, reverse=True)
    return candidates
