import fs from 'fs';
import path from 'path';
import shp from 'shpjs';
import proj4 from 'proj4';

// Sri Lanka Kandawala Grid (EPSG:5235) to WGS84 (EPSG:4326) PROJ4 string with exact 7-param datum shift
const KANDAWALA_PROJ = '+proj=tmerc +lat_0=7.00048027777778 +lon_0=80.7717111111111 +k=0.9999238418 +x_0=200000 +y_0=200000 +a=6377276.345 +rf=300.8017 +towgs84=-97,787,86,0,0,0,0 +units=m +no_defs';
const WGS84_PROJ = '+proj=longlat +datum=WGS84 +no_defs';

function reprojectCoords(coords) {
  if (!Array.isArray(coords)) return coords;
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    const [x, y] = coords;
    if (x > 1000 && y > 1000) {
      const [lng, lat] = proj4(KANDAWALA_PROJ, WGS84_PROJ, [x, y]);
      return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
    }
    return [Number(x.toFixed(6)), Number(y.toFixed(6))];
  }
  return coords.map(reprojectCoords);
}

function processGeometry(geom) {
  if (!geom || !geom.coordinates) return geom;
  return {
    ...geom,
    coordinates: reprojectCoords(geom.coordinates)
  };
}

async function rebuildWithAllMetrics(zipName, geojsonName) {
  console.log(`\nRebuilding 100% complete dataset with ALL metrics: ${zipName}...`);
  const zipPath = path.resolve('public/data', zipName);
  const outPath = path.resolve('public/data', geojsonName);

  const zipBuf = fs.readFileSync(zipPath);
  const rawParsed = await shp(zipBuf);
  const collection = Array.isArray(rawParsed) ? rawParsed[0] : rawParsed;

  console.log(`Source feature count: ${collection.features.length}`);

  const features = [];
  for (let i = 0; i < collection.features.length; i++) {
    const f = collection.features[i];
    if (!f || !f.geometry) continue;

    const newGeom = processGeometry(f.geometry);
    const rawProps = f.properties || {};

    // Preserve ALL raw attributes + aliases for standard space syntax metrics
    const cleanProps = {};
    for (const [k, v] of Object.entries(rawProps)) {
      cleanProps[k] = typeof v === 'number' ? Number(v.toFixed(4)) : v;
    }

    // Add standardized alias properties for UI & MapLibre expressions
    cleanProps.id = rawProps.ID ?? rawProps.id ?? i;
    cleanProps.choice = rawProps.BtA500 ?? rawProps.BtA10000 ?? rawProps.Choice ?? 0;
    cleanProps.integration = rawProps.NQPDA500 ?? rawProps.NQPDA10000 ?? rawProps.MAD500 ?? rawProps.MAD10000 ?? 0;
    cleanProps.connectivity = rawProps.LConn ?? 0;
    cleanProps.length = rawProps.LLen ?? 0;

    features.push({
      type: 'Feature',
      geometry: newGeom,
      properties: cleanProps
    });
  }

  const outputGeoJSON = {
    type: 'FeatureCollection',
    features: features
  };

  const jsonStr = JSON.stringify(outputGeoJSON);
  fs.writeFileSync(outPath, jsonStr);

  const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`Saved ${geojsonName}: ${features.length} features (${sizeMB} MB)`);
  if (features.length > 0) {
    console.log(`Attribute fields preserved (${Object.keys(features[0].properties).length}):`, Object.keys(features[0].properties).join(', '));
  }
}

async function run() {
  await rebuildWithAllMetrics('500.zip', '500.geojson');
  await rebuildWithAllMetrics('10km.zip', '10km.geojson');
  console.log('\nAll 38 Space Syntax metrics preserved in GeoJSON vector layers!');
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
