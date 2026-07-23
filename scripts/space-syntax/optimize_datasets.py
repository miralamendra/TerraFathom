import json
import gzip
import os

def optimize_geojson(input_path, output_json_path, output_gz_path, metric_type='500'):
    print(f"Optimizing {input_path}...")
    if not os.path.exists(input_path):
        print(f"Error: File not found {input_path}")
        return

    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    total_features = len(data.get('features', []))
    print(f"Loaded {total_features:,} features.")

    new_features = []
    is_10k = metric_type == '10k' or '10k' in input_path or '10km' in input_path

    for feat in data['features']:
        props = feat.get('properties', {})
        
        # Preserve essential scientific fields with optimal float precision
        if is_10k:
            clean_props = {
                'segment_id': int(props.get('segment_id', props.get('ID', 0))),
                'BtA10000': round(float(props.get('BtA10000', props.get('BtA10k', props.get('choice', 0)))), 2),
                'NQPDA10000': round(float(props.get('NQPDA10000', props.get('integration', 0))), 4),
                'MAD10000': round(float(props.get('MAD10000', props.get('MAD500', 0))), 2),
                'choice': round(float(props.get('choice', props.get('BtA10000', 0))), 2),
                'integration': round(float(props.get('integration', props.get('NQPDA10000', 0))), 4),
            }
        else:
            clean_props = {
                'segment_id': int(props.get('segment_id', props.get('ID', 0))),
                'BtA500': round(float(props.get('BtA500', props.get('choice', 0))), 2),
                'NQPDA500': round(float(props.get('NQPDA500', props.get('integration', 0))), 4),
                'MAD500': round(float(props.get('MAD500', 0)), 2),
                'choice': round(float(props.get('choice', props.get('BtA500', 0))), 2),
                'integration': round(float(props.get('integration', props.get('NQPDA500', 0))), 4),
            }

        # 6 decimal places = 10cm accuracy (zero perceptual loss on map zoom 0-22)
        geom_type = feat['geometry']['type']
        if geom_type == 'LineString':
            coords = [[round(pt[0], 6), round(pt[1], 6)] for pt in feat['geometry']['coordinates']]
        elif geom_type == 'MultiLineString':
            coords = [[[round(pt[0], 6), round(pt[1], 6)] for pt in line] for line in feat['geometry']['coordinates']]
        else:
            coords = feat['geometry']['coordinates']

        new_features.append({
            'type': 'Feature',
            'properties': clean_props,
            'geometry': {'type': geom_type, 'coordinates': coords}
        })

    clean_fc = {'type': 'FeatureCollection', 'features': new_features}
    json_bytes = json.dumps(clean_fc, separators=(',', ':')).encode('utf-8')
    
    with open(output_json_path, 'wb') as f:
        f.write(json_bytes)

    gz_bytes = gzip.compress(json_bytes, compresslevel=9)
    with open(output_gz_path, 'wb') as f:
        f.write(gz_bytes)

    print(f"Saved {output_json_path}: {len(json_bytes)/1024/1024:.2f} MB")
    print(f"Saved {output_gz_path}: {len(gz_bytes)/1024/1024:.2f} MB")

if __name__ == '__main__':
    base_dir = 'public/data'
    optimize_geojson(f'{base_dir}/500.geojson', f'{base_dir}/500.geojson', f'{base_dir}/500.geojson.gz', '500')
    optimize_geojson(f'{base_dir}/10km.geojson', f'{base_dir}/10km.geojson', f'{base_dir}/10km.geojson.gz', '10k')
