"""
Noise Classifier.

Classifies features as "noise" (e.g. parking aisles, private driveways, footways
in vehicle-only mode) based on the selected AnalysisProfile.
"""

from __future__ import annotations

import logging
import geopandas as gpd

from urban_engine.config import AnalysisProfile
from urban_engine.road_classes import RoadClass

logger = logging.getLogger("urban_engine.semantics.noise_classifier")


def classify_noise(
    roads_gdf: gpd.GeoDataFrame,
    profile: AnalysisProfile,
    include_private_access: bool = False,
    include_construction: bool = False,
) -> gpd.GeoDataFrame:
    """
    Classify roads as noise/excluded based on the AnalysisProfile and options.
    Adds a boolean column 'is_noise' to the GeoDataFrame.
    """
    if roads_gdf.empty:
        return roads_gdf

    roads_gdf = roads_gdf.copy()
    is_noise_list = []

    for idx, row in roads_gdf.iterrows():
        is_noise = False
        road_class = row.get("road_class")
        highway = row.get("highway")
        service = row.get("service")
        access = row.get("access")

        # 1. Access restrictions
        if not include_private_access:
            if access in ("private", "no") or service == "driveway":
                is_noise = True

        # 2. Construction geometry
        if not include_construction:
            if highway == "construction" or road_class == RoadClass.UNKNOWN:
                is_noise = True

        # 3. Profile-specific classification
        if profile == AnalysisProfile.PHYSICAL_VEHICLE:
            # Vehicular profile: exclude pedestrian-only features
            if road_class in (RoadClass.PEDESTRIAN, RoadClass.PATH, RoadClass.STEPS):
                is_noise = True

        elif profile == AnalysisProfile.PEDESTRIAN:
            # Pedestrian profile: exclude motorways or link roads if restricted
            if road_class == RoadClass.MOTORWAY:
                is_noise = True
            
            # Check foot/pedestrian access tags
            foot = row.get("foot")
            if foot in ("no", "private"):
                is_noise = True

        is_noise_list.append(1 if is_noise else 0)

    roads_gdf["is_noise"] = is_noise_list
    
    return roads_gdf
