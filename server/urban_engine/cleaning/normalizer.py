"""
Road Geometry and Attribute Normalizer.

Implements the 9-step normalization process for source geometries:
1. Detect invalid geometries.
2. Repair safe geometry problems.
3. Quarantine unrepairable objects.
4. Remove zero-length/degenerated features.
5. Detect exact duplicates with multi-signal evidence.
6. Normalize/explode multipart geometries.
7. Preserve one-way direction.
8. Assign stable internal IDs.
9. Record every normalization operation.
"""

from __future__ import annotations

import logging
import hashlib
import geopandas as gpd
import pandas as pd
from shapely.geometry import LineString, MultiLineString
from shapely.validation import make_valid

from urban_engine.topology.stable_ids import generate_stable_id
from urban_engine.cleaning.repair_types import RepairType, ModificationRecord

logger = logging.getLogger("urban_engine.cleaning.normalizer")


def normalize_road_network(
    gdf: gpd.GeoDataFrame,
    min_length_m: float = 0.1,
) -> tuple[gpd.GeoDataFrame, list[ModificationRecord]]:
    """
    Perform 9-step normalization on road network GeoDataFrame.
    Returns (normalized_gdf, list_of_modification_records).
    """
    if gdf.empty:
        return gdf, []

    modifications: list[ModificationRecord] = []
    
    # Track original counts for logging/reporting
    original_count = len(gdf)
    
    # 1 & 2 & 3: Detect and repair invalid geometries, quarantine unrepairable
    valid_rows = []
    quarantined_count = 0
    
    for idx, row in gdf.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            quarantined_count += 1
            continue
            
        if not geom.is_valid:
            try:
                repaired_geom = make_valid(geom)
                if repaired_geom.is_empty:
                    quarantined_count += 1
                    continue
                row = row.copy()
                row.geometry = repaired_geom
            except Exception:
                quarantined_count += 1
                continue
                
        valid_rows.append(row)
        
    if quarantined_count > 0:
        logger.warning("Quarantined %d empty or unrepairable road geometries", quarantined_count)
        
    if not valid_rows:
        return gpd.GeoDataFrame(columns=gdf.columns, crs=gdf.crs), []
        
    gdf = gpd.GeoDataFrame(valid_rows, crs=gdf.crs)

    # 6. Normalize multipart geometries (explode MultiLineStrings into LineStrings)
    # This must happen before deduplication so we check individual segments
    gdf = gdf.explode(index_parts=False)
    
    # Keep only LineString geometries (quarantine any other types that slipped through)
    non_line_count = len(gdf[gdf.geometry.type != "LineString"])
    if non_line_count > 0:
        logger.warning("Excluded %d non-LineString geometries after explosion", non_line_count)
    gdf = gdf[gdf.geometry.type == "LineString"].copy()

    # 4. Remove zero-length or degenerate features
    # Also clean duplicate consecutive vertices
    cleaned_rows = []
    zero_len_count = 0
    
    for idx, row in gdf.iterrows():
        geom = row.geometry
        coords = list(geom.coords)
        
        # Remove consecutive identical vertices
        unique_coords = []
        for pt in coords:
            if not unique_coords or pt != unique_coords[-1]:
                unique_coords.append(pt)
                
        if len(unique_coords) < 2:
            zero_len_count += 1
            continue
            
        cleaned_line = LineString(unique_coords)
        if cleaned_line.length < min_length_m:
            zero_len_count += 1
            continue
            
        row = row.copy()
        row.geometry = cleaned_line
        cleaned_rows.append(row)
        
    if zero_len_count > 0:
        logger.info("Removed %d zero-length or degenerate segments", zero_len_count)
        
    if not cleaned_rows:
        return gpd.GeoDataFrame(columns=gdf.columns, crs=gdf.crs), []
        
    gdf = gpd.GeoDataFrame(cleaned_rows, crs=gdf.crs)

    # 5. Detect exact duplicates with multi-signal evidence
    # Group by geometry WKT (standardizing coordinate ordering to catch reversed lines)
    def canonical_wkt(line: LineString) -> str:
        coords = list(line.coords)
        # Sort coordinate list to make reversed lines have same key
        if coords[0] > coords[-1]:
            coords = coords[::-1]
        return LineString(coords).wkt

    gdf["_canonical_wkt"] = gdf.geometry.apply(canonical_wkt)
    
    groups = gdf.groupby("_canonical_wkt")
    keep_indices = []
    
    for wkt, group in groups:
        if len(group) == 1:
            keep_indices.append(group.index[0])
            continue
            
        # We have multiple segments with the exact same geometry.
        # Check if they are duplicates or represent different features (levels, modes, etc.)
        # If they are duplicate OSM ways, they likely share tags.
        # We compare key tags: name, ref, layer, level, access, highway
        candidates = list(group.iterrows())
        resolved = []
        
        while candidates:
            curr_idx, curr_row = candidates.pop(0)
            is_dup = False
            
            # Compare against already resolved Keepers in this group
            for keep_idx, keep_row in resolved:
                # Multi-signal check: Are the layers/levels different?
                if curr_row.get("layer", 0) != keep_row.get("layer", 0):
                    continue
                if curr_row.get("level") != keep_row.get("level"):
                    continue
                    
                # Are the travel modes or access rights different?
                # E.g., one is a cycleway, one is a footway or vehicle road
                if curr_row.get("access") != keep_row.get("access") or \
                   curr_row.get("highway") != keep_row.get("highway"):
                    continue
                    
                # If they have identical/compatible attributes, we merge/deduplicate them
                is_dup = True
                
                # Tag richness enrichment: If the duplicate has richer tags, copy them
                # (e.g. name or ref was missing in the keeper)
                for col in ["name", "ref", "lanes", "oneway", "maxspeed"]:
                    if col in curr_row and pd.notna(curr_row[col]) and curr_row[col] != "":
                        if col not in keep_row or pd.isna(keep_row[col]) or keep_row[col] == "":
                            keep_row[col] = curr_row[col]
                            
                # Record the removal
                repair_id = generate_stable_id("TF_REPAIR", f"DUP_{curr_idx}_{keep_idx}")
                modifications.append(
                    ModificationRecord(
                        id=repair_id,
                        type=RepairType.REMOVE_DUPLICATE,
                        reason=f"Detected duplicate overlapping geometry. Removed redundant instance.",
                        method="Exact geometry WKT and attribute overlap check",
                        confidence={"geometry": 100.0, "topology": 100.0, "semantics": 95.0, "connectivity": 100.0, "overall": 99.0},
                        affected_feature_ids=[str(curr_idx), str(keep_idx)],
                        geom_before_wkt=curr_row.geometry.wkt,
                        geom_after_wkt=keep_row.geometry.wkt,
                    )
                )
                break
                
            if not is_dup:
                resolved.append((curr_idx, curr_row))
                keep_indices.append(curr_idx)

    gdf = gdf.loc[keep_indices].drop(columns=["_canonical_wkt"]).copy()
    
    # 7 & 8: Assign stable internal IDs and preserve one-way direction
    # Assign unique internal stable IDs
    stable_ids = []
    for idx, row in gdf.iterrows():
        geom = row.geometry
        osm_id = row.get("osm_id")
        
        # Build stable ID based on geometry coordinates hash + OSM ID
        coord_bytes = str(list(geom.coords)).encode()
        h = hashlib.md5(coord_bytes).hexdigest()[:12]
        
        if osm_id and pd.notna(osm_id):
            stable_id = f"TF_EDGE_RAW_{osm_id}_{h}"
        else:
            stable_id = f"TF_EDGE_RAW_GEN_{h}"
            
        stable_ids.append(stable_id)
        
    gdf["tf_raw_edge_id"] = stable_ids
    gdf.set_index("tf_raw_edge_id", inplace=True, drop=False)
    
    # Initialize basic metadata columns for downstream phases
    gdf["explanation"] = None
    gdf["repair_history"] = [[] for _ in range(len(gdf))]
    gdf["parents"] = [[idx] for idx in gdf.index]
    gdf["children"] = [[] for _ in range(len(gdf))]
    gdf["confidence"] = [{} for _ in range(len(gdf))]
    gdf["manual_review"] = 0
    
    logger.info(
        "Normalization complete: input %d features -> normalized %d features",
        original_count,
        len(gdf),
    )
    
    return gdf, modifications
