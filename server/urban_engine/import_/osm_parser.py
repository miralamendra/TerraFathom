"""
OSM Parser.

Streaming OSM XML/PBF parser using pyosmium.
Builds Geopandas GeoDataFrames for roads and buildings without loading entire raw XML into memory.
"""

from __future__ import annotations

import logging
from pathlib import Path
import osmium
import geopandas as gpd
import pandas as pd
import shapely.wkb as wkblib
from shapely.geometry import LineString, Polygon, MultiPolygon
from shapely.geometry.base import BaseGeometry

from urban_engine.exceptions import OSMParseFailed
from urban_engine.road_classes import classify_road, RoadClass

logger = logging.getLogger("urban_engine.import.osm_parser")


class OSMHandler(osmium.SimpleHandler):
    """
    Osmium handler that streams OSM features and extracts roads & buildings.
    Saves parsed features to temporary lists.
    """

    def __init__(self, include_buildings: bool = True) -> None:
        super().__init__()
        self.include_buildings = include_buildings
        self.wkbfab = osmium.geom.WKBFactory()
        
        # Roads
        self.road_geoms: list[BaseGeometry] = []
        self.road_attributes: list[dict] = []
        
        # Buildings
        self.building_geoms: list[BaseGeometry] = []
        self.building_attributes: list[dict] = []

        # Node coordinates mapping: node_id -> (lon, lat)
        self.node_coordinates: dict[int, tuple[float, float]] = {}

    def way(self, w: osmium.osm.Way) -> None:
        # Check roads
        if "highway" in w.tags:
            highway_tag = w.tags.get("highway")
            road_class = classify_road(highway_tag)
            
            # Apply basic profile filtering
            if road_class != RoadClass.UNKNOWN:
                try:
                    wkb = self.wkbfab.create_linestring(w)
                    geom = wkblib.loads(wkb)
                    if isinstance(geom, LineString):
                        self.road_geoms.append(geom)
                        
                        # Capture node IDs and locations
                        osm_nodes = [n.ref for n in w.nodes]
                        for n in w.nodes:
                            self.node_coordinates[n.ref] = (n.lon, n.lat)

                        self.road_attributes.append({
                            "osm_id": w.id,
                            "osm_nodes": osm_nodes,
                            "timestamp": w.timestamp.isoformat() if w.timestamp else None,
                            "highway": highway_tag,
                            "name": w.tags.get("name"),
                            "ref": w.tags.get("ref"),
                            "oneway": w.tags.get("oneway"),
                            "lanes": w.tags.get("lanes"),
                            "junction": w.tags.get("junction"),
                            "bridge": w.tags.get("bridge"),
                            "tunnel": w.tags.get("tunnel"),
                            "level": w.tags.get("level"),
                            "layer": w.tags.get("layer"),
                            "access": w.tags.get("access"),
                            "vehicle": w.tags.get("vehicle"),
                            "motor_vehicle": w.tags.get("motor_vehicle"),
                            "foot": w.tags.get("foot"),
                            "bicycle": w.tags.get("bicycle"),
                            "service": w.tags.get("service"),
                            "surface": w.tags.get("surface"),
                            "width": w.tags.get("width"),
                            "covered": w.tags.get("covered"),
                            "ford": w.tags.get("ford"),
                            "barrier": w.tags.get("barrier"),
                            "maxspeed": w.tags.get("maxspeed"),
                        })
                except Exception as e:
                    # Skip geometry construction failures (e.g. invalid refs)
                    pass

        # Check buildings
        if self.include_buildings and "building" in w.tags:
            try:
                wkb = self.wkbfab.create_multipolygon(w)
                geom = wkblib.loads(wkb)
                if isinstance(geom, (Polygon, MultiPolygon)):
                    self.building_geoms.append(geom)
                    self.building_attributes.append({
                        "osm_id": w.id,
                        "building": w.tags.get("building"),
                        "name": w.tags.get("name"),
                        "height": w.tags.get("height"),
                        "levels": w.tags.get("building:levels"),
                    })
            except Exception:
                pass


def parse_osm_file(
    file_path: Path,
    include_buildings: bool = True,
) -> tuple[gpd.GeoDataFrame, gpd.GeoDataFrame, dict[int, tuple[float, float]]]:
    """
    Parse an OSM XML or PBF file.
    Returns (roads_gdf, buildings_gdf, node_coordinates) in WGS84 (EPSG:4326).
    """
    if not file_path.exists():
        raise OSMParseFailed(f"OSM file does not exist: {file_path}")

    handler = OSMHandler(include_buildings=include_buildings)

    try:
        # We must enable node location caching so osmium can resolve way coordinates
        handler.apply_file(str(file_path), locations=True)
    except Exception as e:
        raise OSMParseFailed(f"Failed to parse OSM file: {e}")

    # Build roads GeoDataFrame
    if handler.road_geoms:
        roads_df = pd.DataFrame(handler.road_attributes)
        roads_gdf = gpd.GeoDataFrame(roads_df, geometry=handler.road_geoms, crs="EPSG:4326")
    else:
        roads_gdf = gpd.GeoDataFrame(columns=["osm_id", "highway", "geometry"], crs="EPSG:4326")

    # Build buildings GeoDataFrame
    if handler.building_geoms:
        buildings_df = pd.DataFrame(handler.building_attributes)
        buildings_gdf = gpd.GeoDataFrame(buildings_df, geometry=handler.building_geoms, crs="EPSG:4326")
    else:
        buildings_gdf = gpd.GeoDataFrame(columns=["osm_id", "building", "geometry"], crs="EPSG:4326")

    logger.info(
        "Parsed %d roads and %d buildings from %s",
        len(roads_gdf),
        len(buildings_gdf),
        file_path.name,
    )

    return roads_gdf, buildings_gdf, handler.node_coordinates
