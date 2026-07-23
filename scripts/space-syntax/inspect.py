import os
import sys
import json
import math
import hashlib
import numpy as np
import fiona
import pyproj
import geopandas as gpd

def sha256_checksum(filepath):
    if not os.path.exists(filepath):
        return None
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()

def inspect_shapefile_bundle(prefix, folder='Data'):
    bundle = {}
    exts = ['.shp', '.shx', '.dbf', '.prj', '.cpg']
    for ext in exts:
        fn = f"{prefix}{ext}"
        fp = os.path.join(folder, fn)
        if os.path.exists(fp):
            bundle[ext] = {
                'path': fp,
                'size_bytes': os.path.getsize(fp),
                'sha256': sha256_checksum(fp)
            }
        else:
            bundle[ext] = None

    if not bundle['.shp'] or not bundle['.shx'] or not bundle['.dbf'] or not bundle['.prj']:
        raise ValueError(f"Missing mandatory shapefile component for {prefix} in {folder}")

    # Read PRJ
    with open(bundle['.prj']['path'], 'r') as f:
        prj_wkt = f.read().strip()

    crs = pyproj.CRS.from_wkt(prj_wkt)

    # Read with geopandas / fiona
    gdf = gpd.read_file(bundle['.shp']['path'])
    
    feature_count = len(gdf)
    geometry_types = gdf.geometry.geom_type.value_counts().to_dict()
    empty_geoms = int(gdf.geometry.is_empty.sum())
    invalid_geoms = int((~gdf.geometry.is_valid).sum())
    
    # Calculate zero-length geometries
    lengths = gdf.geometry.length
    zero_length_count = int((lengths == 0).sum())

    # Schema and fields
    field_stats = {}
    allowlisted_metrics = []
    
    # Identify unique ID candidate
    id_candidates = [c for c in gdf.columns if c.lower() in ['id', 'segment_id', 'fid', 'objectid', 'ref_id']]
    id_column = id_candidates[0] if id_candidates else None
    duplicate_ids = int(gdf[id_column].duplicated().sum()) if id_column else 0

    for col in gdf.columns:
        if col == 'geometry':
            continue

        series = gdf[col]
        dtype_str = str(series.dtype)

        is_numeric = np.issubdtype(series.dtype, np.number)
        
        # Check non-finite
        null_cnt = int(series.isna().sum())
        nan_cnt = 0
        inf_cnt = 0
        
        if is_numeric:
            nan_cnt = int(np.isnan(series).sum()) - null_cnt
            inf_cnt = int(np.isinf(series.dropna()).sum())
            clean_vals = series.replace([np.inf, -np.inf], np.nan).dropna()
        else:
            clean_vals = series.dropna()

        col_stat = {
            'type': dtype_str,
            'null_count': null_cnt,
            'nan_count': max(0, nan_cnt),
            'inf_count': inf_cnt,
        }

        # Exclude IDs, bearings, coords from percentile calculation
        is_id_or_meta = col.lower() in ['id', 'fid', 'objectid', 'index', 'ref_id', 'segment_id', 'bearing', 'dir', 'direction', 'angle', 'x', 'y', 'lat', 'lon']
        
        if is_numeric and not is_id_or_meta and len(clean_vals) > 0:
            allowlisted_metrics.append(col)
            pcts = np.percentile(clean_vals, [5, 20, 50, 80, 90, 95, 99])
            col_stat['percentiles'] = {
                'min': float(np.min(clean_vals)),
                'max': float(np.max(clean_vals)),
                'p5': float(pcts[0]),
                'p20': float(pcts[1]),
                'p50': float(pcts[2]),
                'p80': float(pcts[3]),
                'p90': float(pcts[4]),
                'p95': float(pcts[5]),
                'p99': float(pcts[6]),
            }

        field_stats[col] = col_stat

    bounds = list(gdf.total_bounds) # [minx, miny, maxx, maxy]

    return {
        'prefix': prefix,
        'bundle': bundle,
        'crs_name': crs.name,
        'crs_wkt': prj_wkt,
        'crs_epsg': crs.to_epsg(),
        'bounds_native': bounds,
        'feature_count': feature_count,
        'geometry_types': geometry_types,
        'empty_geometry_count': empty_geoms,
        'invalid_geometry_count': invalid_geoms,
        'zero_length_geometry_count': zero_length_count,
        'id_column': id_column,
        'duplicate_id_count': duplicate_ids,
        'allowlisted_metrics': allowlisted_metrics,
        'field_stats': field_stats
    }

def main():
    print("Executing Phase 1: Source Validation...")
    os.makedirs('public/data', exist_ok=True)
    os.makedirs('scripts/space-syntax', exist_ok=True)

    info_500 = inspect_shapefile_bundle('500', 'Data')
    info_10k = inspect_shapefile_bundle('10km', 'Data')

    report = {
        'dataset_version': '1.0.0-western-province-spacesyntax',
        'inspection_date': '2026-07-23',
        'datasets': {
            '500m_local': info_500,
            '10km_regional': info_10k
        }
    }

    # Save JSON
    json_path = 'public/data/space-syntax-validation.json'
    with open(json_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"Saved {json_path}")

    # Generate Markdown
    md_path = 'public/data/space-syntax-validation.md'
    with open(md_path, 'w') as f:
        f.write("# Space Syntax Dataset Validation Audit Report\n\n")
        f.write(f"**Version**: {report['dataset_version']}\n")
        f.write(f"**Inspection Date**: {report['inspection_date']}\n\n")

        for key, d in report['datasets'].items():
            f.write(f"## Dataset: {d['prefix']} ({key})\n")
            f.write(f"- **CRS Name**: `{d['crs_name']}`\n")
            f.write(f"- **EPSG**: `{d['crs_epsg']}`\n")
            f.write(f"- **Feature Count**: `{d['feature_count']:,}`\n")
            f.write(f"- **Native Bounds**: `{d['bounds_native']}`\n")
            f.write(f"- **Empty Geometries**: `{d['empty_geometry_count']}`\n")
            f.write(f"- **Invalid Geometries**: `{d['invalid_geometry_count']}`\n")
            f.write(f"- **Zero-Length Geometries**: `{d['zero_length_geometry_count']}`\n")
            f.write(f"- **Duplicate IDs**: `{d['duplicate_id_count']}`\n\n")
            
            f.write("### File Bundle Checksums (SHA-256)\n")
            for ext, binfo in d['bundle'].items():
                if binfo:
                    f.write(f"- `{ext}`: `{binfo['sha256']}` ({binfo['size_bytes']:,} bytes)\n")
                else:
                    f.write(f"- `{ext}`: *MISSING / ENCODING WARNING*\n")
            f.write("\n")

            f.write("### Allowlisted Metrics & Percentiles\n")
            for m in d['allowlisted_metrics']:
                st = d['field_stats'][m]
                pct = st.get('percentiles', {})
                f.write(f"- **{m}** ({st['type']}) | Nulls: {st['null_count']}, Inf: {st['inf_count']}\n")
                if pct:
                    f.write(f"  - Min: {pct['min']:.4f}, P5: {pct['p5']:.4f}, P50: {pct['p50']:.4f}, P95: {pct['p95']:.4f}, Max: {pct['max']:.4f}\n")
            f.write("\n---\n\n")

    print(f"Saved {md_path}")
    print("Phase 1 Source Validation Complete!")

if __name__ == '__main__':
    main()
