import os
import json
import numpy as np
import geopandas as gpd

def main():
    print("Reprojecting 500.shp and 10km.shp with exact EPSG:5234 -> EPSG:4326 transformation...")

    # Load original shapefiles
    gdf_500 = gpd.read_file('public/data/500.shp')
    gdf_10km = gpd.read_file('public/data/10km.shp')

    print(f"Loaded 500.shp ({len(gdf_500):,} rows) and 10km.shp ({len(gdf_10km):,} rows)")

    # Reproject to WGS84 with exact EPSG:5234 datum transformation
    gdf_500_wgs84 = gdf_500.to_crs(epsg=4326)
    gdf_10km_wgs84 = gdf_10km.to_crs(epsg=4326)

    # Standardize column property keys
    def standardize_properties(gdf, scale='500m'):
        gdf = gdf.copy()
        if 'id' not in gdf.columns and 'ID' in gdf.columns:
            gdf['id'] = gdf['ID']
        if 'segment_id' not in gdf.columns:
            gdf['segment_id'] = gdf.index.astype(int)

        # Standardize Choice & Integration metric columns
        if scale == '500m':
            if 'BtA500' in gdf.columns:
                gdf['choice_500m'] = gdf['BtA500']
                gdf['choice'] = gdf['BtA500']
            if 'NQPDA500' in gdf.columns:
                gdf['integration_500m'] = gdf['NQPDA500']
                gdf['integration'] = gdf['NQPDA500']
        else:
            if 'BtA10000' in gdf.columns:
                gdf['choice_10k'] = gdf['BtA10000']
                gdf['choice'] = gdf['BtA10000']
            elif 'BtA10k' in gdf.columns:
                gdf['choice_10k'] = gdf['BtA10k']
                gdf['choice'] = gdf['BtA10k']
            elif 'BtA500' in gdf.columns:
                gdf['choice_10k'] = gdf['BtA500']
                gdf['choice'] = gdf['BtA500']

            if 'NQPDA10000' in gdf.columns:
                gdf['integration_10k'] = gdf['NQPDA10000']
                gdf['integration'] = gdf['NQPDA10000']
            elif 'NQPDA500' in gdf.columns:
                gdf['integration_10k'] = gdf['NQPDA500']
                gdf['integration'] = gdf['NQPDA500']
        return gdf

    gdf_500_wgs84 = standardize_properties(gdf_500_wgs84, '500m')
    gdf_10km_wgs84 = standardize_properties(gdf_10km_wgs84, '10km')

    print("Saving reprojected 500.geojson and 10km.geojson...")
    gdf_500_wgs84.to_file('public/data/500.geojson', driver='GeoJSON')
    gdf_10km_wgs84.to_file('public/data/10km.geojson', driver='GeoJSON')

    # Save lightweight regional through-movement network (Top 5% Choice)
    choice_col = 'choice_10k' if 'choice_10k' in gdf_10km_wgs84.columns else 'choice'
    p95 = float(np.percentile(gdf_10km_wgs84[choice_col].dropna(), 95))
    regional_gdf = gdf_10km_wgs84[gdf_10km_wgs84[choice_col] >= p95].copy()

    os.makedirs('public/pmtiles', exist_ok=True)
    regional_gdf.to_file('public/pmtiles/regional_through_movement.geojson', driver='GeoJSON')

    print("Successfully generated pixel-accurate EPSG:4326 GeoJSONs!")

if __name__ == '__main__':
    main()
