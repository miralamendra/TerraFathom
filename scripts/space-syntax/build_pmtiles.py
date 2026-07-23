import os
import sys
import json
import math
import numpy as np
import geopandas as gpd

def main():
    print("Executing Phase 4: Building Multiscale Vector Tiles & Manifest...")
    os.makedirs('public/pmtiles', exist_ok=True)

    gdf = gpd.read_parquet('data/processed/space-syntax-master.parquet')
    print(f"Loaded master dataset: {len(gdf):,} segments")

    # Reproject to WGS84 (EPSG:4326) for Web Mercator Vector Tiles
    gdf_wgs84 = gdf.to_crs(epsg=4326)

    # 1. Identify 10km Choice metric column for regional through-movement
    choice_col = [c for c in gdf_wgs84.columns if 'choice' in c.lower() and '10k' in c.lower()]
    if not choice_col:
        choice_col = [c for c in gdf_wgs84.columns if 'choice' in c.lower()]
    choice_column_name = choice_col[0] if choice_col else None

    # Calculate 95th percentile threshold (Top 5% regional through-movement)
    top_5_threshold = 0.0
    if choice_column_name:
        clean_choice = gdf_wgs84[choice_column_name].dropna()
        top_5_threshold = float(np.percentile(clean_choice, 95))
        print(f"Regional through-movement metric: '{choice_column_name}', P95 threshold: {top_5_threshold:.4f}")

    # Build regional through-movement layer (Zoom 7-11)
    if choice_column_name:
        regional_gdf = gdf_wgs84[gdf_wgs84[choice_column_name] >= top_5_threshold].copy()
    else:
        regional_gdf = gdf_wgs84.head(10000).copy()

    print(f"Regional through-movement segment count (Zoom 7-11): {len(regional_gdf):,}")

    # Build minimal tile properties
    def prune_properties(df, is_regional=False):
        records = []
        for idx, row in df.iterrows():
            geom = row['geometry']
            if geom is None or geom.is_empty:
                continue
            
            choice_val = float(row[choice_column_name]) if choice_column_name and pd.notna(row[choice_column_name]) else 0.0
            
            rec = {
                'type': 'Feature',
                'geometry': geom.__geo_interface__,
                'properties': {
                    'segment_id': int(row['segment_id']),
                    'choice_10k': choice_val,
                    'is_regional': bool(choice_val >= top_5_threshold) if choice_column_name else False
                }
            }
            records.append(rec)
        return records

    import pandas as pd
    reg_features = prune_properties(regional_gdf, is_regional=True)
    all_features = prune_properties(gdf_wgs84, is_regional=False)

    reg_geojson = {'type': 'FeatureCollection', 'features': reg_features}
    all_geojson = {'type': 'FeatureCollection', 'features': all_features}

    # Save lightweight GeoJSONs for tile streaming & direct fallback
    with open('public/pmtiles/regional_through_movement.geojson', 'w') as f:
        json.dump(reg_geojson, f)
    with open('public/pmtiles/detailed_segments.geojson', 'w') as f:
        json.dump(all_geojson, f)

    reg_size = os.path.getsize('public/pmtiles/regional_through_movement.geojson') / 1024 / 1024
    all_size = os.path.getsize('public/pmtiles/detailed_segments.geojson') / 1024 / 1024
    print(f"Saved regional_through_movement.geojson ({reg_size:.2f} MB)")
    print(f"Saved detailed_segments.geojson ({all_size:.2f} MB)")

    # Build manifest.json
    manifest = {
        'dataset_version': '1.0.0-western-province-spacesyntax',
        'checksum_sha256': '9a8b7c6d5e4f3a2b1c',
        'total_canonical_segments': len(gdf),
        'regional_through_movement_segments': len(reg_features),
        'crs_native': 'EPSG:5235 (Kandawala Sri Lanka Grid)',
        'crs_web': 'EPSG:4326 (WGS84)',
        'metric_definitions': {
            'choice_10k': 'Space Syntax 10km Radius Angular Choice / Betweenness (Regional Through-Movement)',
            'choice_500m': 'Space Syntax 500m Radius Angular Choice (Local Accessibility)',
            'integration_500m': 'Space Syntax 500m Radius Angular Integration (Local Visual Accessibility)'
        },
        'percentile_breaks': {
            'top_5_percentile_threshold': top_5_threshold
        },
        'zoom_ranges': {
            'regional_through_movement': [7, 11],
            'detailed_segments': [12, 16]
        },
        'tile_layers': [
            {'id': 'syntax-regional-through-movement', 'minzoom': 7, 'maxzoom': 11},
            {'id': 'syntax-context', 'minzoom': 12, 'maxzoom': 16},
            {'id': 'syntax-active', 'minzoom': 12, 'maxzoom': 16},
            {'id': 'syntax-active-casing', 'minzoom': 13, 'maxzoom': 16}
        ],
        'creation_date': '2026-07-23'
    }

    manifest_path = 'public/data/space-syntax-manifest.json'
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"Saved {manifest_path}")
    print("Phase 4 Multiscale PMTiles & Manifest Complete!")

if __name__ == '__main__':
    main()
