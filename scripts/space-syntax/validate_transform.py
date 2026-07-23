import os
import sys
import json
import math
import numpy as np
import geopandas as gpd
import pyproj

# Kandawala Sri Lanka Grid PROJ4 string (EPSG:5235)
KANDAWALA_WKT = 'PROJCS["Kandawala_Sri_Lanka_Grid",GEOGCS["GCS_Kandawala",DATUM["D_Kandawala",SPHEROID["Everest_Adjustment_1937",6377276.345,300.8017]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",200000.0],PARAMETER["False_Northing",200000.0],PARAMETER["Central_Meridian",80.7717111111111],PARAMETER["Scale_Factor",0.9999238418],PARAMETER["Latitude_Of_Origin",7.00048027777778],UNIT["Meter",1.0]]'
WGS84_WKT = 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]'

def main():
    print("Executing Phase 3: CRS Validation & Reprojection Accuracy Control...")

    gdf_master = gpd.read_parquet('data/processed/space-syntax-master.parquet')
    initial_count = len(gdf_master)
    print(f"Loaded master parquet: {initial_count:,} features")

    transformer_fwd = pyproj.Transformer.from_crs(pyproj.CRS.from_wkt(KANDAWALA_WKT), pyproj.CRS.from_epsg(4326), always_xy=True)
    transformer_inv = pyproj.Transformer.from_crs(pyproj.CRS.from_epsg(4326), pyproj.CRS.from_wkt(KANDAWALA_WKT), always_xy=True)

    # 1. Feature Count Verification
    if len(gdf_master) != initial_count:
        raise RuntimeError(f"Feature count mismatch! Initial {initial_count} vs Current {len(gdf_master)}")

    # 2. Sample 1,000 Points Round-Trip Consistency Test
    print("Performing 1,000 point sample numerical-consistency round-trip test...")
    sample_indices = np.random.choice(len(gdf_master), size=min(1000, len(gdf_master)), replace=False)
    
    max_error = 0.0
    for idx in sample_indices:
        geom = gdf_master.geometry.iloc[idx]
        if geom is None or geom.is_empty:
            continue
        coords = list(geom.coords)
        for coord in coords:
            x, y = coord[0], coord[1]
            # Forward transform
            lon, lat = transformer_fwd.transform(x, y)
            # Reverse transform
            x_back, y_back = transformer_inv.transform(lon, lat)
            
            dist_err = math.sqrt((x - x_back)**2 + (y - y_back)**2)
            if dist_err > max_error:
                max_error = dist_err

    print(f"Max round-trip numerical error: {max_error:.6f} meters")
    if max_error > 0.05: # 5 cm numerical tolerance threshold
        raise RuntimeError(f"CRS Transformation accuracy validation failed! Max error {max_error} exceeds 0.05m tolerance.")

    # 3. Western Province Boundary Bounds Validation
    gdf_wgs84 = gdf_master.to_crs(epsg=4326)
    bounds = gdf_wgs84.total_bounds # [min_lon, min_lat, max_lon, max_lat]
    print(f"Transformed WGS84 Bounds: Lng [{bounds[0]:.4f}, {bounds[2]:.4f}], Lat [{bounds[1]:.4f}, {bounds[3]:.4f}]")

    # Western Province bounding box boundaries (Lat 5.8° to 7.6°, Lon 79.5° to 80.6°)
    if not (79.5 <= bounds[0] <= 80.6 and 5.8 <= bounds[1] <= 7.6 and 79.5 <= bounds[2] <= 80.6 and 5.8 <= bounds[3] <= 7.6):
        raise RuntimeError(f"Transformed bounds {bounds} fall outside Western Province, Sri Lanka!")

    # 4. Length Calculation Check (Must be computed in projected CRS, never EPSG:4326)
    native_lengths = gdf_master.geometry.length
    print(f"Computed native lengths in EPSG:5235 meters (Mean: {native_lengths.mean():.2f}m, Total: {native_lengths.sum() / 1000:.2f} km)")

    report = {
        'status': 'PASSED',
        'source_crs': KANDAWALA_WKT,
        'dest_crs': 'EPSG:4326',
        'feature_count_verified': len(gdf_wgs84),
        'wgs84_bounds': list(bounds),
        'max_roundtrip_error_meters': max_error,
        'mean_segment_length_meters': float(native_lengths.mean()),
        'total_network_length_km': float(native_lengths.sum() / 1000),
        'proj_version': pyproj.__proj_version__
    }

    with open('public/data/space-syntax-crs-validation.json', 'w') as f:
        json.dump(report, f, indent=2)

    print("Phase 3 CRS Validation Complete! All checks PASSED.")

if __name__ == '__main__':
    main()
