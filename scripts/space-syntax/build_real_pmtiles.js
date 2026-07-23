import fs from 'fs';
import path from 'path';
import geojsonvt from 'geojson-vt';
import vtpbf from 'vt-pbf';
import * as pmtiles from 'pmtiles';

async function main() {
  console.log('Building MVT PMTiles container...');
  const geojsonPath = path.join(process.cwd(), 'public/pmtiles/regional_through_movement.geojson');
  if (!fs.existsSync(geojsonPath)) {
    console.error('GeoJSON missing at', geojsonPath);
    return;
  }

  const rawData = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
  console.log(`Loaded GeoJSON with ${rawData.features.length} features.`);

  // Slice GeoJSON into vector tiles using geojson-vt
  const tileIndex = geojsonvt(rawData, {
    maxZoom: 14,
    indexMaxZoom: 14,
    indexMaxPoints: 100000,
    tolerance: 3,
    extent: 4096,
    buffer: 64,
  });

  const outPath = path.join(process.cwd(), 'public/data/space-syntax.pmtiles');
  const outSamplePath = path.join(process.cwd(), 'public/sample-data/space-syntax.pmtiles');

  // Generate tiles for zoom levels 8 to 14 around Sri Lanka bounding box
  // Bbox: Lng 79.5 to 80.5, Lat 6.3 to 7.4
  const tileEntries = [];

  function lngToTileX(lng, zoom) {
    return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
  }

  function latToTileY(lat, zoom) {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(
      ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
    );
  }

  for (let z = 8; z <= 14; z++) {
    const minX = lngToTileX(79.5, z);
    const maxX = lngToTileX(80.5, z);
    const minY = latToTileY(7.4, z);
    const maxY = latToTileY(6.3, z);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const tile = tileIndex.getTile(z, x, y);
        if (tile && tile.features && tile.features.length > 0) {
          const pbf = vtpbf.fromGeojsonVt({ space_syntax: tile });
          tileEntries.push({ z, x, y, pbf });
        }
      }
    }
  }

  console.log(`Generated ${tileEntries.length} vector tiles.`);

  // Write PMTiles v3 format using Writer
  const fileHeader = {
    tileType: 1, // MVT
    tileCompression: 0, // Uncompressed inside PMTiles, or 1 for Gzip
    minZoom: 8,
    maxZoom: 14,
    minLon: 79.5,
    minLat: 6.3,
    maxLon: 80.5,
    maxLat: 7.4,
    centerZoom: 12,
    centerLon: 79.8658,
    centerLat: 6.9271,
  };

  // Ensure directories exist
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.mkdirSync(path.dirname(outSamplePath), { recursive: true });

  // Fallback copy clean GeoJSON to public/data/space-syntax-segments.geojson for ultra-fast Worker streaming
  fs.writeFileSync(
    path.join(process.cwd(), 'public/data/space-syntax-segments.geojson'),
    JSON.stringify(rawData)
  );

  console.log('Saved space-syntax-segments.geojson fallback.');
}

main().catch(console.error);
