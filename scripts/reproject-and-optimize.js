import fs from 'fs';
import path from 'path';
import shp from 'shpjs';
import proj4 from 'proj4';

// Kandawala Sri Lanka Grid PROJ4 string (EPSG:5235) with 7-parameter / 3-parameter WGS84 datum shift
const KANDAWALA_PROJ = '+proj=tmerc +lat_0=7.00048027777778 +lon_0=80.7717111111111 +k=0.9999238418 +x_0=200000 +y_0=200000 +a=6377276.345 +rf=300.8017 +towgs84=-97,787,86,0,0,0,0 +units=m +no_defs';
const WGS84_PROJ = '+proj=longlat +datum=WGS84 +no_defs';

function reprojectCoords(coords) {
  if (!Array.isArray(coords)) return coords;
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    const [x, y] = coords;
    // Check if coordinates are in Sri Lanka Grid meters (~100,000 to 500,000)
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

async function reprojectDataset(zipName, geojsonName) {
  console.log(`\nProcessing ${zipName}...`);
  const zipPath = path.resolve('public/data', zipName);
  const outPath = path.resolve('public/data', geojsonName);

  const zipBuf = fs.readFileSync(zipPath);
  const rawParsed = await shp(zipBuf);
  const collection = Array.isArray(rawParsed) ? rawParsed[0] : rawParsed;

  console.log(`Original feature count: ${collection.features.length}`);

  // Reproject features and keep essential properties
  const reprojectedFeatures = [];
  
  // Sample every Nth feature or keep features in Colombo/Western Province
  const step = collection.features.length > 100000 ? 2 : 1; // Downsample high-density lines if over 100k

  for (let i = 0; i < collection.features.length; i += step) {
    const f = collection.features[i];
    if (!f || !f.geometry) continue;

    const newGeom = processGeometry(f.geometry);

    // Keep key Space Syntax attributes
    const props = f.properties || {};
    const cleanProps = {
      id: props.id || props.FID || i,
      choice: props.choice || props.Choice || props.Choice_500 || props.Choice_10k || 0,
      integration: props.integration || props.Integratio || props.Integ_500 || props.Integ_10k || 0,
      connectivity: props.connectivity || props.Connectivi || 0,
    };

    reprojectedFeatures.push({
      type: 'Feature',
      geometry: newGeom,
      properties: cleanProps
    });
  }

  const outputGeoJSON = {
    type: 'FeatureCollection',
    features: reprojectedFeatures
  };

  const jsonStr = JSON.stringify(outputGeoJSON);
  fs.writeFileSync(outPath, jsonStr);

  const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`Saved ${geojsonName}: ${reprojectedFeatures.length} features (${sizeMB} MB)`);

  // Sample coordinate bounds
  if (reprojectedFeatures.length > 0 && reprojectedFeatures[0].geometry.coordinates) {
    const sampleCoord = reprojectedFeatures[0].geometry.coordinates[0];
    console.log(`Sample reprojected coordinate (WGS84 Lng/Lat):`, sampleCoord);
  }
}

async function run() {
  await reprojectDataset('500.zip', '500.geojson');
  await reprojectDataset('10km.zip', '10km.geojson');
  console.log('\nReprojection and optimization complete!');
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
