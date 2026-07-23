import os
import sys
import json
import sqlite3
import numpy as np
import geopandas as gpd
import pandas as pd

def main():
    print("Executing Phase 2: Building Cross-Scale Canonical Master Dataset...")
    os.makedirs('data/processed', exist_ok=True)

    print("Loading 500m shapefile...")
    gdf_500 = gpd.read_file('Data/500.shp')
    print("Loading 10km shapefile...")
    gdf_10k = gpd.read_file('Data/10km.shp')

    # Detect shared unique ID column
    id_col_500 = [c for c in gdf_500.columns if c.lower() in ['id', 'fid', 'objectid', 'ref_id', 'segment_id']][0]
    id_col_10k = [c for c in gdf_10k.columns if c.lower() in ['id', 'fid', 'objectid', 'ref_id', 'segment_id']][0]

    print(f"Joining using shared ID column: 500m='{id_col_500}', 10km='{id_col_10k}'")

    # Rename ID columns to original_id for clarity
    gdf_500 = gdf_500.rename(columns={id_col_500: 'original_id'})
    gdf_10k = gdf_10k.rename(columns={id_col_10k: 'original_id'})

    # Duplicate key checks
    dup_500 = int(gdf_500['original_id'].duplicated().sum())
    dup_10k = int(gdf_10k['original_id'].duplicated().sum())

    ids_500 = set(gdf_500['original_id'])
    ids_10k = set(gdf_10k['original_id'])

    matched_ids = ids_500.intersection(ids_10k)
    only_500_ids = ids_500 - ids_10k
    only_10k_ids = ids_10k - ids_500

    print(f"Join statistics: Matched={len(matched_ids):,}, 500m-only={len(only_500_ids):,}, 10km-only={len(only_10k_ids):,}")
    print(f"Duplicate key counts: 500m={dup_500}, 10km={dup_10k}")

    # Prefixes for attributes
    df_500_attrs = gdf_500.drop(columns=['geometry']).add_prefix('r500_')
    df_500_attrs = df_500_attrs.rename(columns={'r500_original_id': 'original_id'})

    df_10k_attrs = gdf_10k.drop(columns=['geometry']).add_prefix('r10k_')
    df_10k_attrs = df_10k_attrs.rename(columns={'r10k_original_id': 'original_id'})

    # Full outer join on original_id
    merged_attrs = pd.merge(df_500_attrs, df_10k_attrs, on='original_id', how='outer')

    # Merge geometries (prefer 500m geometry, fallback to 10km geometry)
    geom_map = {}
    for idx, row in gdf_500.iterrows():
        geom_map[row['original_id']] = row['geometry']
    for idx, row in gdf_10k.iterrows():
        if row['original_id'] not in geom_map:
            geom_map[row['original_id']] = row['geometry']

    geometries = [geom_map.get(oid) for oid in merged_attrs['original_id']]

    canonical_gdf = gpd.GeoDataFrame(merged_attrs, geometry=geometries, crs=gdf_500.crs)

    # Assign stable 64-bit integer segment_id
    canonical_gdf['segment_id'] = canonical_gdf['original_id'].astype(np.int64)

    # Clean non-finite numbers & add validity flags
    for col in canonical_gdf.columns:
        if col in ['segment_id', 'original_id', 'geometry']:
            continue
        if np.issubdtype(canonical_gdf[col].dtype, np.number):
            non_finite_mask = np.isinf(canonical_gdf[col]) | np.isnan(canonical_gdf[col])
            if non_finite_mask.sum() > 0:
                flag_col = f"{col}_valid_flag"
                canonical_gdf[flag_col] = ~non_finite_mask
                canonical_gdf.loc[non_finite_mask, col] = None

    # Save Master Parquet
    parquet_path = 'data/processed/space-syntax-master.parquet'
    canonical_gdf.to_parquet(parquet_path)
    print(f"Saved {parquet_path} ({os.path.getsize(parquet_path) / 1024 / 1024:.2f} MB)")

    # Save Master GeoPackage
    gpkg_path = 'data/processed/space-syntax-master.gpkg'
    canonical_gdf.to_file(gpkg_path, driver='GPKG', layer='space_syntax_segments')
    print(f"Saved {gpkg_path} ({os.path.getsize(gpkg_path) / 1024 / 1024:.2f} MB)")

    # Create SQLite Analytical Database with Indexes
    db_path = 'data/processed/space-syntax.db'
    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    # Save non-geometry attribute table to SQLite
    attr_df = canonical_gdf.drop(columns=['geometry'])
    attr_df.to_sql('space_syntax_segments', conn, if_exists='replace', index=False)

    cursor = conn.cursor()
    cursor.execute('CREATE UNIQUE INDEX idx_segment_id ON space_syntax_segments(segment_id);')
    
    # Create indexes on numeric metric columns that exist
    for col in attr_df.columns:
        if 'choice' in col.lower() or 'integ' in col.lower():
            try:
                cursor.execute(f'CREATE INDEX idx_{col} ON space_syntax_segments("{col}");')
            except Exception:
                pass

    conn.commit()
    conn.close()
    print(f"Saved indexed SQLite database {db_path} ({os.path.getsize(db_path) / 1024 / 1024:.2f} MB)")

    # Save summary report
    summary = {
        'total_canonical_segments': len(canonical_gdf),
        'matched_count': len(matched_ids),
        'only_500m_count': len(only_500_ids),
        'only_10km_count': len(only_10k_ids),
        'duplicate_500m_ids': dup_500,
        'duplicate_10km_ids': dup_10k,
        'crs_wkt': gdf_500.crs.to_wkt()
    }
    with open('data/processed/space-syntax-join-summary.json', 'w') as f:
        json.dump(summary, f, indent=2)

    print("Phase 2 Cross-Scale Canonical Dataset Complete!")

if __name__ == '__main__':
    main()
