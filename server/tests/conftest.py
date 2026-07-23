"""
Pytest configuration and test fixtures.
"""

from __future__ import annotations

import pytest
import geopandas as gpd
import pandas as pd
from shapely.geometry import LineString, Point, Polygon


@pytest.fixture
def sample_roads() -> gpd.GeoDataFrame:
    """Fixture returning a simple network of 3 intersecting segments in UTM (analysis CRS)."""
    # Cross shape: one vertical line, two horizontal lines meeting it
    line1 = LineString([(0, 0), (10, 0)]) # Main street
    line2 = LineString([(5, -5), (5, 5)])  # Cross street
    line3 = LineString([(0, 0), (10, 0)])  # Duplicate of line 1 (to test validation/repair)

    df = pd.DataFrame([
        {"id": "road_1", "highway": "primary", "name": "Main St"},
        {"id": "road_2", "highway": "residential", "name": "Cross St"},
        {"id": "road_3", "highway": "primary", "name": "Main St Duplicate"},
    ])
    
    gdf = gpd.GeoDataFrame(df, geometry=[line1, line2, line3], crs="EPSG:32631")  # UTM 31N
    return gdf


@pytest.fixture
def sample_buildings() -> gpd.GeoDataFrame:
    """Fixture returning building footprints."""
    poly1 = Polygon([(2, 2), (4, 2), (4, 4), (2, 4)])
    poly2 = Polygon([(6, -3), (8, -3), (8, -1), (6, -1)])
    
    df = pd.DataFrame([
        {"id": "build_1", "building": "residential"},
        {"id": "build_2", "building": "commercial"},
    ])
    gdf = gpd.GeoDataFrame(df, geometry=[poly1, poly2], crs="EPSG:32631")
    return gdf
