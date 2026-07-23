from __future__ import annotations

import pytest
import geopandas as gpd
import pandas as pd
from shapely.geometry import LineString, Point

from urban_engine.road_classes import RoadClass
from urban_engine.semantics.semantics_engine import SemanticsEngine
from urban_engine.cleaning.corridor_inference import CorridorInferenceEngine
from urban_engine.validation.connectivity import ConnectivityVerifier

@pytest.fixture
def corridor_sample_network() -> Tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
    # Two parallel arterials close to each other (offset by 5m horizontally)
    line_a = LineString([(0, 0), (0, 100)])
    line_b = LineString([(5, 0), (5, 100)])
    
    # A roundabout (square loop of 4 segments)
    r1 = LineString([(20, 20), (30, 20)])
    r2 = LineString([(30, 20), (30, 30)])
    r3 = LineString([(30, 30), (20, 30)])
    r4 = LineString([(20, 30), (20, 20)])
    
    # Connecting road to roundabout
    line_c = LineString([(10, 25), (20, 25)])

    roads_df = pd.DataFrame([
        {"id": "road_a", "highway": "primary", "name": "Parallel Ave", "layer": 0},
        {"id": "road_b", "highway": "primary", "name": "Parallel Ave", "layer": 0},
        {"id": "r1", "highway": "tertiary", "junction": "roundabout", "layer": 0},
        {"id": "r2", "highway": "tertiary", "junction": "roundabout", "layer": 0},
        {"id": "r3", "highway": "tertiary", "junction": "roundabout", "layer": 0},
        {"id": "r4", "highway": "tertiary", "junction": "roundabout", "layer": 0},
        {"id": "road_c", "highway": "residential", "name": "Link Rd", "layer": 0},
    ])
    
    roads_gdf = gpd.GeoDataFrame(roads_df, geometry=[line_a, line_b, r1, r2, r3, r4, line_c], crs="EPSG:32631")
    roads_gdf["road_class"] = [RoadClass.ARTERIAL, RoadClass.ARTERIAL, RoadClass.COLLECTOR, RoadClass.COLLECTOR, RoadClass.COLLECTOR, RoadClass.COLLECTOR, RoadClass.LOCAL]

    # Nodes
    nodes_df = pd.DataFrame([
        {"node_id": "n1"}, {"node_id": "n2"},
        {"node_id": "rn1"}, {"node_id": "rn2"}, {"node_id": "rn3"}, {"node_id": "rn4"},
        {"node_id": "cn1"}, {"node_id": "cn2"}
    ])
    nodes_geom = [
        Point(0, 0), Point(0, 100),
        Point(20, 20), Point(30, 20), Point(30, 30), Point(20, 30),
        Point(10, 25), Point(20, 25)
    ]
    nodes_gdf = gpd.GeoDataFrame(nodes_df, geometry=nodes_geom, crs="EPSG:32631")
    nodes_gdf.set_index("node_id", inplace=True, drop=False)

    # Set start/end nodes on roads
    roads_gdf["start_node"] = ["n1", "n1", "rn1", "rn2", "rn3", "rn4", "cn1"]
    roads_gdf["end_node"] = ["n2", "n2", "rn2", "rn3", "rn4", "rn1", "rn1"]

    return roads_gdf, nodes_gdf

def test_semantics_classification(corridor_sample_network):
    roads, nodes = corridor_sample_network
    engine = SemanticsEngine(roads, nodes)
    res_roads, res_nodes = engine.process()
    
    # Verify TF stable IDs exist
    assert "tf_edge_id" in res_roads.columns
    assert "tf_node_id" in res_nodes.columns
    assert "tf_junction_id" in res_nodes.columns
    
    # Verify junction types classification
    assert "junction_type" in res_nodes.columns
    roundabout_nodes = res_nodes[res_nodes["junction_type"] == "roundabout_junction"]
    assert len(roundabout_nodes) > 0

def test_corridor_inference_and_roundabout(corridor_sample_network):
    roads, nodes = corridor_sample_network
    
    # Run semantics first
    sem_engine = SemanticsEngine(roads, nodes)
    sem_roads, sem_nodes = sem_engine.process()
    
    # Run corridor inference
    corr_engine = CorridorInferenceEngine(sem_roads, sem_nodes)
    inf_roads, inf_nodes, modifications, roundabout_maps = corr_engine.process()
    
    # 1. Verify parallel roads road_a and road_b got merged
    # Since they are merged, there should be a segment representing Parallel Ave with parents list
    merged_rows = inf_roads[inf_roads["parents"].apply(lambda p: len(p) > 1)]
    assert len(merged_rows) == 1
    assert "road_a" in merged_rows.iloc[0]["parents"]
    assert "road_b" in merged_rows.iloc[0]["parents"]
    
    # 2. Verify roundabout is mapped to centroid but original geometries are preserved (not deleted)
    assert len(roundabout_maps) > 0
    # Original r1, r2, r3, r4 segments still exist in inf_roads
    for r_id in ["r1", "r2", "r3", "r4"]:
        # Find by ID or matching properties
        assert any(r_id in r["parents"] for _, r in inf_roads.iterrows())

def test_connectivity_verification(corridor_sample_network):
    roads, nodes = corridor_sample_network
    
    # Run semantics first
    sem_engine = SemanticsEngine(roads, nodes)
    sem_roads, sem_nodes = sem_engine.process()
    
    verifier = ConnectivityVerifier(sem_roads, sem_nodes)
    report = verifier.verify()
    
    assert report["total_components"] > 0
    assert "largest_component_pct" in report
    assert "dead_ends_count" in report
