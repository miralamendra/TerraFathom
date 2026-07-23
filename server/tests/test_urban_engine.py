"""
Comprehensive Test Suite for the Universal Urban Network Engine.
"""

from __future__ import annotations

import geopandas as gpd
import networkx as nx
from shapely.geometry import LineString, Point

from urban_engine.road_classes import RoadClass, classify_road
from urban_engine.spatial_index import SpatialIndexEngine
from urban_engine.cleaning.geometry_cleaner import clean_road_dataframe
from urban_engine.validation.validator import NetworkValidator
from urban_engine.cleaning.auto_repair import repair_network
from urban_engine.topology.splitter import split_at_intersections
from urban_engine.topology.shared_node import build_topology
from urban_engine.graph.derived_attributes import compute_edge_attributes
from urban_engine.graph.graph_builder import GraphBuilder
from urban_engine.buildings.extractor import extract_and_enrich_buildings
from urban_engine.statistics.collector import collect_all_statistics
from urban_engine.quality.confidence import calculate_confidence_scores


# ── 1. Road Classes Tests ─────────────────────────────────────────────────────

def test_road_classification():
    assert classify_road("motorway") == RoadClass.MOTORWAY
    assert classify_road("primary") == RoadClass.ARTERIAL
    assert classify_road("residential") == RoadClass.LOCAL
    assert classify_road("footway") == RoadClass.PEDESTRIAN
    assert classify_road("unknown_tag") == RoadClass.UNKNOWN
    assert classify_road(None) == RoadClass.UNKNOWN


# ── 2. Spatial Index Tests ────────────────────────────────────────────────────

def test_spatial_index(sample_roads):
    idx = SpatialIndexEngine.from_geodataframe(sample_roads)
    assert idx.size == 3

    # Query intersection at point
    pt = Point(5, 0)
    matches = idx.query_intersects(pt)
    # The point lies on both main street (idx 0), cross street (idx 1), and duplicate (idx 2)
    assert len(matches) == 3


# ── 3. Geometry Cleaner Tests ─────────────────────────────────────────────────

def test_geometry_cleaner():
    # Line with duplicate consecutive vertices
    line = LineString([(0, 0), (0, 0), (5, 0), (5, 0), (10, 0)])
    gdf = gpd.GeoDataFrame(geometry=[line], crs="EPSG:32631")
    
    cleaned = clean_road_dataframe(gdf, min_length_m=1.0)
    assert len(cleaned) == 1
    assert len(cleaned.geometry.iloc[0].coords) == 3  # (0,0), (5,0), (10,0)


# ── 4. Validation & Repair Tests ──────────────────────────────────────────────

def test_validator_and_repair(sample_roads):
    # The duplicate road (road_3) should be identified
    validator = NetworkValidator(sample_roads)
    issues = validator.validate_all(snap_tolerance=0.5)
    
    codes = [i.code for i in issues]
    assert "duplicate_edges" in codes

    # Auto repair should drop the duplicate edge
    repaired, summary = repair_network(sample_roads, snap_tolerance_m=0.5)
    assert len(repaired) == 2  # 2 original segments after duplicate removal
    assert summary["detected"] > 0
    assert summary["auto_fixed"] > 0


# ── 5. Topology Builder Tests ─────────────────────────────────────────────────

def test_topology_builder(sample_roads):
    # Remove duplicate road first
    clean_gdf = sample_roads.iloc[:2].copy()
    
    # Split them at crossing
    split_gdf = split_at_intersections(clean_gdf, snap_tolerance_m=0.5)
    # The intersection is at (5,0)
    # main street [(0,0) to (10,0)] splits into [(0,0) to (5,0)] and [(5,0) to (10,0)]
    # cross street [(5,-5) to (5,5)] splits into [(5,-5) to (5,0)] and [(5,0) to (5,5)]
    assert len(split_gdf) == 4

    nodes_gdf, segments_gdf = build_topology(split_gdf, snap_tolerance_m=0.5)
    
    # Intersections, start and end points of lines: (0,0), (10,0), (5,-5), (5,5), and center junction (5,0)
    assert len(nodes_gdf) == 5
    assert len(segments_gdf) == 4
    
    # Check start/end node assignments exist
    assert "start_node" in segments_gdf.columns
    assert "end_node" in segments_gdf.columns
    assert "edge_id" in segments_gdf.columns


# ── 6. Derived Attributes Tests ───────────────────────────────────────────────

def test_derived_attributes(sample_roads):
    clean_gdf = sample_roads.iloc[:2].copy()
    split_gdf = split_at_intersections(clean_gdf, snap_tolerance_m=0.5)
    nodes_gdf, segments_gdf = build_topology(split_gdf, snap_tolerance_m=0.5)

    enriched_segs = compute_edge_attributes(segments_gdf, nodes_gdf)
    assert "bearing" in enriched_segs.columns
    assert "curvature" in enriched_segs.columns
    assert "speed_kmh" in enriched_segs.columns
    assert "lanes" in enriched_segs.columns
    assert "dead_end" in enriched_segs.columns


# ── 7. Graph Builder Tests ────────────────────────────────────────────────────

def test_graph_builder(sample_roads):
    clean_gdf = sample_roads.iloc[:2].copy()
    split_gdf = split_at_intersections(clean_gdf, snap_tolerance_m=0.5)
    nodes_gdf, segments_gdf = build_topology(split_gdf, snap_tolerance_m=0.5)
    enriched_segs = compute_edge_attributes(segments_gdf, nodes_gdf)

    builder = GraphBuilder(enriched_segs, nodes_gdf)
    
    phys = builder.build_physical_graph()
    assert isinstance(phys, nx.MultiGraph)
    assert phys.number_of_nodes() == 5
    assert phys.number_of_edges() == 4


# ── 8. Buildings Enrichment Tests ─────────────────────────────────────────────

def test_buildings_enrichment(sample_roads, sample_buildings):
    clean_gdf = sample_roads.iloc[:2].copy()
    split_gdf = split_at_intersections(clean_gdf, snap_tolerance_m=0.5)
    nodes_gdf, segments_gdf = build_topology(split_gdf, snap_tolerance_m=0.5)
    enriched_segs = compute_edge_attributes(segments_gdf, nodes_gdf)

    enriched_builds = extract_and_enrich_buildings(
        sample_buildings,
        enriched_segs,
        min_area_m2=1.0,
    )
    
    assert len(enriched_builds) == 2
    assert "area_m2" in enriched_builds.columns
    assert "perimeter_m" in enriched_builds.columns
    assert "compactness" in enriched_builds.columns
    assert "nearest_road_id" in enriched_builds.columns


# ── 9. Confidence and Stats Tests ─────────────────────────────────────────────

def test_statistics_and_confidence(sample_roads, sample_buildings):
    clean_gdf = sample_roads.iloc[:2].copy()
    split_gdf = split_at_intersections(clean_gdf, snap_tolerance_m=0.5)
    nodes_gdf, segments_gdf = build_topology(split_gdf, snap_tolerance_m=0.5)
    enriched_segs = compute_edge_attributes(segments_gdf, nodes_gdf)
    
    builder = GraphBuilder(enriched_segs, nodes_gdf)
    graphs = {
        "physical": builder.build_physical_graph(),
        "directed": builder.build_directed_graph(),
    }

    # Mock context object
    class MockContext:
        def __init__(self):
            self.road_segments = enriched_segs
            self.road_nodes = nodes_gdf
            self.buildings = extract_and_enrich_buildings(sample_buildings, enriched_segs, min_area_m2=1.0)
            self.repair_results = {"detected": 0, "auto_fixed": 0, "manual_review": 0}
            self.metadata = type("Metadata", (), {
                "processing_time_s": 0.5,
                "peak_memory_mb": 128.0,
                "phase_timings": {},
                "import_date": "2026-07-18",
                "software_version": "1.0",
            })()
            self.warnings = []
            self.analysis_crs = "EPSG:32631"

    ctx = MockContext()
    stats = collect_all_statistics(ctx, graphs)
    
    assert "roads" in stats
    assert "buildings" in stats
    assert "connectivity" in stats
    assert "performance" in stats

    scores = calculate_confidence_scores(
        enriched_segs,
        nodes_gdf,
        graphs["physical"],
        ctx.repair_results,
    )
    
    assert "overall" in scores
    assert "geometry" in scores
    assert "topology" in scores


def test_qa_report_and_benchmark(sample_roads):
    from urban_engine.quality.qa_report import generate_qa_report
    from urban_engine.quality.benchmark import NetworkBenchmark
    from urban_engine.graph.graph_builder import GraphBuilder
    from urban_engine.graph.derived_attributes import compute_edge_attributes

    nodes_gdf, segments_gdf = build_topology(sample_roads, snap_tolerance_m=0.5)
    enriched_segs = compute_edge_attributes(segments_gdf, nodes_gdf)
    builder = GraphBuilder(enriched_segs, nodes_gdf)

    class MockContext:
        def __init__(self):
            self.road_segments = enriched_segs
            self.road_nodes = nodes_gdf
            self.buildings = None
            self.graphs = {
                "physical": builder.build_physical_graph()
            }
            self.validation_issues = []

    ctx = MockContext()
    report = generate_qa_report(ctx)
    assert report["status"] in ("passed", "needs_work")
    assert "geometry_checks" in report
    assert "topology_checks" in report
    assert "semantic_checks" in report

    # Test Benchmark
    bench = NetworkBenchmark(enriched_segs, enriched_segs)
    results = bench.run_evaluation(tolerance_m=3.0)
    assert results["evaluated"] is True
    assert results["geometric"]["precision"] == 100.0
    assert results["geometric"]["recall"] == 100.0


def test_earth_engine_analysis():
    from urban_engine.analysis.earth_engine import analyze_polygon
    
    geom = {
        "type": "Polygon",
        "coordinates": [[[79.85, 6.90], [79.87, 6.90], [79.87, 6.94], [79.85, 6.94], [79.85, 6.90]]]
    }
    
    results = analyze_polygon(geom)
    
    assert results["success"] is True
    assert "metrics" in results
    assert "elevation" in results["metrics"]
    assert "ndvi" in results["metrics"]
    assert "nightlights" in results["metrics"]
    assert "source" in results


def test_earth_engine_map_layers():
    from urban_engine.analysis.earth_engine import get_earth_engine_map
    
    geom = {
        "type": "Polygon",
        "coordinates": [[[79.85, 6.90], [79.87, 6.90], [79.87, 6.94], [79.85, 6.94], [79.85, 6.90]]]
    }
    
    res = get_earth_engine_map(geom, "elevation")
    assert res["success"] is True
    assert "legend" in res
    assert "source" in res
    assert len(res["legend"]) > 0
    if res["mode"] == "fallback_grid":
        assert "geojson" in res
        assert res["geojson"]["type"] == "FeatureCollection"
        assert len(res["geojson"]["features"]) > 0
    else:
        assert res["mode"] == "live_tiles"
        assert "tile_url" in res

    res_ndvi = get_earth_engine_map(geom, "ndvi")
    assert res_ndvi["success"] is True
    assert len(res_ndvi["legend"]) > 0



