"""
Crossing Resolver.

Evaluates geometric line crossings in the network:
- Check tag-based grade-separations (bridge, tunnel, layer).
- Determine whether they represent missing at-grade intersections
  or valid grade-separated crossings.
- Propose splits and connectivity.
"""

from __future__ import annotations

import logging
import geopandas as gpd
from shapely.geometry import Point, LineString, MultiPoint
from shapely.ops import split

from urban_engine.spatial_index import SpatialIndexEngine
from urban_engine.cleaning.repair_types import RepairType, ModificationRecord
from urban_engine.topology.stable_ids import generate_stable_id

logger = logging.getLogger("urban_engine.cleaning.crossing_resolver")


class CrossingCandidate:
    """Represents a geometric intersection crossing that needs evaluation."""

    def __init__(
        self,
        edge_a_id: str,
        edge_b_id: str,
        intersection_point: tuple[float, float],
        confidence: float,
        action: str,  # "auto_repair", "manual_review", "preserve"
        explanation: str,
    ) -> None:
        self.edge_a_id = edge_a_id
        self.edge_b_id = edge_b_id
        self.intersection_point = intersection_point
        self.confidence = confidence
        self.action = action
        self.explanation = explanation


def resolve_crossings(
    roads_gdf: gpd.GeoDataFrame,
    snap_tolerance_m: float = 0.5,
) -> tuple[gpd.GeoDataFrame, list[ModificationRecord]]:
    """
    Scan roads for crossing segments.
    Resolves at-grade crossings by splitting and inserting nodes.
    Preserves grade-separated crossings.
    """
    if roads_gdf.empty:
        return roads_gdf, []

    idx_engine = SpatialIndexEngine.from_geodataframe(roads_gdf)
    modifications: list[ModificationRecord] = []
    
    # We will process and construct a new list of rows
    # Keep track of splits to avoid double-processing
    repaired_features = []
    processed_indices = set()
    
    # Pre-build candidate list to avoid modifying during iteration
    split_targets: dict[str, list[Point]] = {}  # edge_id -> list of split points

    for idx, row in roads_gdf.iterrows():
        geom = row.geometry
        if not isinstance(geom, LineString):
            continue

        intersecting = idx_engine.query_intersects(geom)
        
        # Check grade separation tags on current
        layer_a = row.get("layer", 0)
        try:
            layer_a = int(layer_a) if layer_a is not None else 0
        except Exception:
            layer_a = 0
            
        bridge_a = row.get("bridge") == "yes" or row.get("bridge") is True
        tunnel_a = row.get("tunnel") == "yes" or row.get("tunnel") is True

        for other_idx in intersecting:
            if other_idx == idx:
                continue

            other_row = roads_gdf.loc[other_idx]
            other_geom = other_row.geometry

            # Do they actually cross geometrically?
            if geom.crosses(other_geom):
                # Check tag-based grade separation
                layer_b = other_row.get("layer", 0)
                try:
                    layer_b = int(layer_b) if layer_b is not None else 0
                except Exception:
                    layer_b = 0
                    
                bridge_b = other_row.get("bridge") == "yes" or other_row.get("bridge") is True
                tunnel_b = other_row.get("tunnel") == "yes" or other_row.get("tunnel") is True

                # Grade separation validation
                if layer_a != layer_b:
                    # Different layers -> valid grade separation, do not connect!
                    continue
                if (bridge_a and not bridge_b) or (tunnel_a and not tunnel_b):
                    # One is bridge/tunnel, the other is at-grade -> valid separation, do not connect!
                    continue

                # Same level crossing but not sharing node -> candidate for connection!
                inter_geom = geom.intersection(other_geom)
                if inter_geom.is_empty:
                    continue

                points_to_split = []
                if isinstance(inter_geom, Point):
                    points_to_split.append(inter_geom)
                elif isinstance(inter_geom, MultiPoint):
                    points_to_split.extend(inter_geom.geoms)

                for pt in points_to_split:
                    # Check if it's already close to the start or end vertex of either line
                    # to prevent creating tiny dangles or slivers
                    is_endpoint = False
                    for line_geom in (geom, other_geom):
                        coords = list(line_geom.coords)
                        if Point(coords[0]).distance(pt) < snap_tolerance_m or \
                           Point(coords[-1]).distance(pt) < snap_tolerance_m:
                            is_endpoint = True
                            break
                    if is_endpoint:
                        continue

                    # Safe to propose split!
                    split_targets.setdefault(str(idx), []).append(pt)
                    split_targets.setdefault(str(other_idx), []).append(pt)

    # Reconstruct the GeoDataFrame with the split segments
    for idx, row in roads_gdf.iterrows():
        geom = row.geometry
        str_idx = str(idx)
        
        if str_idx in split_targets and isinstance(geom, LineString):
            pts = split_targets[str_idx]
            # Perform split
            try:
                # Merge points to split at all of them at once
                if len(pts) > 1:
                    from shapely.ops import unary_union
                    split_geom = split(geom, unary_union(pts))
                else:
                    split_geom = split(geom, pts[0])
                    
                # Add all valid pieces
                for i, sub_geom in enumerate(split_geom.geoms):
                    if isinstance(sub_geom, LineString) and sub_geom.length >= snap_tolerance_m:
                        new_row = row.copy()
                        new_row.geometry = sub_geom
                        
                        # Generate stable ID for split piece
                        new_id = f"{str_idx}_split_{i}"
                        new_row["parents"] = list(set(list(row.get("parents", [])) + [str_idx]))
                        
                        repaired_features.append(new_row)
                
                # Record modification log
                repair_id = generate_stable_id("TF_REPAIR", f"CROSS_{str_idx}")
                modifications.append(
                    ModificationRecord(
                        id=repair_id,
                        type=RepairType.SPLIT_INTERSECTION,
                        reason="Geometric line crossing detected at the same vertical level.",
                        method="Intersection splitting and node insertion",
                        confidence={"geometry": 99.0, "topology": 99.0, "semantics": 95.0, "connectivity": 100.0, "overall": 98.0},
                        affected_feature_ids=[str_idx],
                        geom_before_wkt=geom.wkt,
                        geom_after_wkt=None,
                    )
                )
            except Exception as e:
                logger.error("Failed to split crossing geometry at %s: %s", str_idx, e)
                repaired_features.append(row)
        else:
            repaired_features.append(row)

    if repaired_features:
        result_gdf = gpd.GeoDataFrame(repaired_features, crs=roads_gdf.crs)
        # Re-index
        result_gdf.index = result_gdf.index.map(str)
        return result_gdf, modifications
    
    return roads_gdf, []
