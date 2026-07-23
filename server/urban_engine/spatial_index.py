"""
Spatial Index Engine.

Wraps Shapely 2 STRtree. Every spatial query goes through here.
Zero brute force — intersections, snapping, nearest road, building
assignment all use the index.
"""

from __future__ import annotations

from typing import Any

import geopandas as gpd
import numpy as np
from numpy.typing import NDArray
from shapely import STRtree
from shapely.geometry.base import BaseGeometry


class SpatialIndexEngine:
    """
    High-performance spatial index built on Shapely 2 STRtree.

    Usage:
        idx = SpatialIndexEngine.from_geodataframe(gdf, "segment_id")
        candidates = idx.query_intersects(some_geometry)
    """

    def __init__(
        self,
        geometries: NDArray[Any],
        ids: NDArray[Any],
    ) -> None:
        self._geometries = geometries
        self._ids = ids
        self._tree = STRtree(geometries)

    @staticmethod
    def from_geodataframe(
        gdf: gpd.GeoDataFrame,
        id_col: str | None = None,
    ) -> SpatialIndexEngine:
        """Build index from a GeoDataFrame."""
        geoms = gdf.geometry.values
        if id_col and id_col in gdf.columns:
            ids = gdf[id_col].values
        else:
            ids = gdf.index.values
        return SpatialIndexEngine(geoms, ids)

    @staticmethod
    def from_arrays(
        geometries: NDArray[Any],
        ids: NDArray[Any],
    ) -> SpatialIndexEngine:
        """Build index from raw arrays."""
        return SpatialIndexEngine(geometries, ids)

    # ── Queries ───────────────────────────────────────────────────────

    def query_intersects(self, geom: BaseGeometry) -> NDArray[Any]:
        """Return IDs of geometries that intersect the query geometry."""
        indices = self._tree.query(geom, predicate="intersects")
        return self._ids[indices]

    def query_contains(self, geom: BaseGeometry) -> NDArray[Any]:
        """Return IDs of geometries that contain the query geometry."""
        indices = self._tree.query(geom, predicate="contains")
        return self._ids[indices]

    def query_within(self, geom: BaseGeometry) -> NDArray[Any]:
        """Return IDs of geometries within the query geometry."""
        indices = self._tree.query(geom, predicate="within")
        return self._ids[indices]

    def query_within_distance(
        self, geom: BaseGeometry, distance: float
    ) -> NDArray[Any]:
        """Return IDs of geometries within `distance` of the query geometry."""
        indices = self._tree.query(geom.buffer(distance), predicate="intersects")
        return self._ids[indices]

    def query_nearest(
        self,
        geom: BaseGeometry,
        max_distance: float | None = None,
    ) -> NDArray[Any]:
        """
        Return IDs of the nearest geometry.
        If max_distance is set, only return result within that distance.
        """
        result = self._tree.nearest(geom)
        if result is None or (isinstance(result, np.ndarray) and len(result) == 0):
            return np.array([])
        
        # If result is single integer, wrap in array
        if isinstance(result, (int, np.integer)):
            idx_array = np.array([result])
        elif isinstance(result, tuple) and len(result) == 2:
            # Shapely 2.0 returns (input_index, tree_index) for bulk query, or a single index
            # Depending on how it's called. If called on single geometry, returns scalar.
            idx_array = np.array([result[1]])
        else:
            idx_array = np.array(result)

        if max_distance is not None:
            # Post-filter by actual distance
            mask = np.array([
                self._geometries[i].distance(geom) <= max_distance
                for i in idx_array
            ])
            idx_array = idx_array[mask]
        
        return self._ids[idx_array]

    def query_pairs(self, distance: float) -> NDArray[Any]:
        """
        Return pairs of indices whose geometries are within `distance`.
        Returns array of shape (N, 2).
        """
        pairs = self._tree.query(self._geometries, predicate="dwithin", distance=distance)
        # pairs is 2×N — transpose to N×2 for readability
        return pairs.T

    def query_bulk_intersects(
        self,
        query_geoms: NDArray[Any],
    ) -> tuple[NDArray[Any], NDArray[Any]]:
        """
        Bulk intersection query. Returns (query_indices, tree_indices).
        Much faster than looping query_intersects.
        """
        input_idx, tree_idx = self._tree.query(query_geoms, predicate="intersects")
        return input_idx, tree_idx

    # ── Properties ────────────────────────────────────────────────────

    @property
    def size(self) -> int:
        return len(self._geometries)

    @property
    def ids(self) -> NDArray[Any]:
        return self._ids
