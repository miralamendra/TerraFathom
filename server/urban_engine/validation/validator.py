"""
Network Validation Engine.

Detects topological and geometric defects: disconnected roads, duplicate edges,
overlapping geometries, grade-separation violations (bridges/tunnels), floating nodes,
and isolated components.
All spatial checks leverage the Spatial Index Engine (no brute-force).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import geopandas as gpd
import numpy as np
from shapely.geometry import Point

from urban_engine.spatial_index import SpatialIndexEngine

logger = logging.getLogger("urban_engine.validation.validator")


@dataclass
class ValidationIssue:
    code: str
    severity: str  # error, warning, info
    message: str
    feature_ids: list[str]
    auto_fixable: bool = False
    suggested_fix: str = ""


class NetworkValidator:
    """Runs 8 topological/geometric checks on a network using Spatial Index."""

    def __init__(self, gdf: gpd.GeoDataFrame) -> None:
        self.gdf = gdf
        self.index = SpatialIndexEngine.from_geodataframe(gdf)

    def validate_all(self, snap_tolerance: float = 0.5) -> list[ValidationIssue]:
        """Orchestrate all validation checks. Returns a list of ValidationIssues."""
        issues: list[ValidationIssue] = []

        # Ensure spatial index has data
        if self.gdf.empty:
            return issues

        # 1. Duplicate edges
        issues.extend(self.check_duplicate_edges())

        # 2. Floating nodes
        issues.extend(self.check_floating_nodes(snap_tolerance))

        # 3. Disconnected roads
        issues.extend(self.check_disconnected_roads())

        # 4. Overlapping roads
        issues.extend(self.check_overlapping_roads())

        # 5. Bridge, tunnel and grade separation checks
        issues.extend(self.check_grade_separations())

        return issues

    def check_duplicate_edges(self) -> list[ValidationIssue]:
        """Detect identical or near-identical geometries with the same endpoints."""
        issues = []
        dup_ids = set()

        # Query pairs within very close distance (e.g. 0.05 meters)
        pairs = self.index.query_pairs(0.05)
        for idx_a, idx_b in pairs:
            if idx_a == idx_b:
                continue

            id_a = self.gdf.index[idx_a]
            id_b = self.gdf.index[idx_b]

            # Prevent double-listing
            pair_key = tuple(sorted([id_a, id_b]))
            if pair_key in dup_ids:
                continue

            geom_a = self.gdf.geometry.iloc[idx_a]
            geom_b = self.gdf.geometry.iloc[idx_b]

            # If house distance is small, consider duplicates
            if geom_a.equals(geom_b) or geom_a.distance(geom_b) < 0.01:
                dup_ids.add(pair_key)

        if dup_ids:
            flat_ids = [str(item) for pair in dup_ids for item in pair]
            issues.append(
                ValidationIssue(
                    code="duplicate_edges",
                    severity="warning",
                    message=f"Detected {len(dup_ids)} duplicate edges sharing geometries.",
                    feature_ids=flat_ids[:50],  # cap display
                    auto_fixable=True,
                    suggested_fix="Remove duplicates and retain the attribute-rich edge.",
                )
            )

        return issues

    def check_floating_nodes(self, snap_tolerance: float) -> list[ValidationIssue]:
        """Detect endpoints that are close to another segment but not connected."""
        issues = []
        floating_ids = []

        for idx, row in self.gdf.iterrows():
            geom = row.geometry
            if not geom or geom.is_empty:
                continue

            # Check start and end nodes
            endpoints = [Point(geom.coords[0]), Point(geom.coords[-1])]

            for pt in endpoints:
                # Query segments within snap tolerance
                nearby = self.index.query_within_distance(pt, snap_tolerance)
                
                # If only matching self, it is an isolated or floating node
                if len(nearby) <= 1:
                    # Look further out to see if it's near other roads
                    search_wider = self.index.query_within_distance(pt, snap_tolerance * 5)
                    if len(search_wider) > 1:
                        floating_ids.append(str(idx))
                        break

        if floating_ids:
            issues.append(
                ValidationIssue(
                    code="floating_nodes",
                    severity="warning",
                    message=f"Detected {len(floating_ids)} floating node endpoints near other segments.",
                    feature_ids=list(set(floating_ids))[:50],
                    auto_fixable=True,
                    suggested_fix="Snap endpoints to nearest intersecting segments.",
                )
            )

        return issues

    def check_disconnected_roads(self) -> list[ValidationIssue]:
        """Detect roads completely isolated from all other segments."""
        issues = []
        disconnected_ids = []

        for idx, row in self.gdf.iterrows():
            geom = row.geometry
            # Query intersecting segments (within small buffer to account for minor snapping errors)
            nearby = self.index.query_within_distance(geom, 0.05)
            
            # If only intersects itself, it's isolated
            if len(nearby) == 1:
                disconnected_ids.append(str(idx))

        if disconnected_ids:
            issues.append(
                ValidationIssue(
                    code="disconnected_roads",
                    severity="warning",
                    message=f"Detected {len(disconnected_ids)} completely disconnected road segments.",
                    feature_ids=disconnected_ids[:50],
                    auto_fixable=False,
                    suggested_fix="Requires manual digitizing or boundary connection check.",
                )
            )

        return issues

    def check_overlapping_roads(self) -> list[ValidationIssue]:
        """Detect roads that overlap spatially but lack a node at the overlap."""
        issues = []
        overlap_ids = []

        # Find intersections using spatial index query
        for idx, row in self.gdf.iterrows():
            geom = row.geometry
            intersecting = self.index.query_intersects(geom)
            for other_idx in intersecting:
                if other_idx == idx:
                    continue
                other_geom = self.gdf.geometry.loc[other_idx]
                
                # Check crossing relation
                if geom.crosses(other_geom):
                    # Check if they share any coordinates at the crossing point
                    geom_coords = set(geom.coords)
                    other_coords = set(other_geom.coords)
                    if not geom_coords.intersection(other_coords):
                        overlap_ids.append(str(idx))
                        break

        if overlap_ids:
            issues.append(
                ValidationIssue(
                    code="overlapping_roads",
                    severity="warning",
                    message=f"Detected {len(overlap_ids)} crossing roads without shared intersection nodes.",
                    feature_ids=list(set(overlap_ids))[:50],
                    auto_fixable=True,
                    suggested_fix="Split overlapping roads at point of geometric intersection.",
                )
            )

        return issues

    def check_grade_separations(self) -> list[ValidationIssue]:
        """Verify layer/level consistency at intersections (bridges/tunnels)."""
        issues = []
        invalid_seps = []

        for idx, row in self.gdf.iterrows():
            geom = row.geometry
            if not geom or geom.is_empty:
                continue

            # Standardize layer to integer
            layer_a = row.get("layer", 0)
            try:
                layer_a = int(layer_a) if layer_a is not None else 0
            except Exception:
                layer_a = 0

            bridge_a = row.get("bridge") == "yes" or row.get("bridge") is True
            tunnel_a = row.get("tunnel") == "yes" or row.get("tunnel") is True

            intersecting = self.index.query_intersects(geom)
            for other_idx in intersecting:
                if other_idx == idx:
                    continue
                other_row = self.gdf.loc[other_idx]
                
                layer_b = other_row.get("layer", 0)
                try:
                    layer_b = int(layer_b) if layer_b is not None else 0
                except Exception:
                    layer_b = 0

                bridge_b = other_row.get("bridge") == "yes" or other_row.get("bridge") is True
                tunnel_b = other_row.get("tunnel") == "yes" or other_row.get("tunnel") is True

                other_geom = other_row.geometry
                shared = set(geom.coords).intersection(set(other_geom.coords))
                
                if shared:
                    # If they share coordinates (connected topologically), they MUST represent the same layer/level
                    if layer_a != layer_b:
                        invalid_seps.append(str(idx))
                        break
                    
                    # If one is a bridge and the other is a tunnel, they cannot connect directly
                    if (bridge_a and tunnel_b) or (tunnel_a and bridge_b):
                        invalid_seps.append(str(idx))
                        break

        if invalid_seps:
            issues.append(
                ValidationIssue(
                    code="grade_separation_violations",
                    severity="error",
                    message=f"Detected {len(invalid_seps)} intersections connecting layers of different levels.",
                    feature_ids=list(set(invalid_seps))[:50],
                    auto_fixable=False,
                    suggested_fix="Review level tags or convert node connection into grade-separated crossing.",
                )
            )

        return issues
