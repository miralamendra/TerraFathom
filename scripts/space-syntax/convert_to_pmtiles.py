import os
import json
import gzip
from pmtiles.writer import Writer
from pmtiles.tile import zxy_to_tileid, TileType, Compression

def main():
    pmtiles_path = 'public/pmtiles/space-syntax-western-province.pmtiles'
    print(f"Building PMTiles container -> {pmtiles_path}...")
    
    with open('public/pmtiles/regional_through_movement.geojson', 'rb') as f:
        geojson_bytes = f.read()

    with open(pmtiles_path, 'wb') as f:
        writer = Writer(f)
        # Write tile at z=11, x=1546, y=987 (Colombo center)
        tile_id = zxy_to_tileid(11, 1546, 987)
        writer.write_tile(tile_id, gzip.compress(geojson_bytes))
        
        header = {
            "tile_type": TileType.MVT,
            "tile_compression": Compression.GZIP,
            "min_zoom": 7,
            "max_zoom": 16,
            "min_lon_e7": int(79.8175 * 10000000),
            "min_lat_e7": int(6.3245 * 10000000),
            "max_lon_e7": int(80.3564 * 10000000),
            "max_lat_e7": int(7.3302 * 10000000),
            "center_zoom": 11,
            "center_lon_e7": int(79.8658 * 10000000),
            "center_lat_e7": int(6.9271 * 10000000)
        }
        metadata = {
            "name": "space-syntax-western-province",
            "format": "mvt",
            "type": "overlay",
            "version": "1.0.0",
            "description": "Space Syntax Western Province, Sri Lanka"
        }
        writer.finalize(header, metadata)

    size_mb = os.path.getsize(pmtiles_path) / 1024 / 1024
    print(f"Successfully generated {pmtiles_path} ({size_mb:.2f} MB)!")

if __name__ == '__main__':
    main()
