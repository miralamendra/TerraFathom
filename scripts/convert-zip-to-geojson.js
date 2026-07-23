import fs from 'fs';
import path from 'path';
import shp from 'shpjs';

async function main() {
  console.log('Testing shp(zipBuffer) parsing...');

  const zip500Buf = fs.readFileSync(path.resolve('public/data/500.zip'));
  const geojson500 = await shp(zip500Buf);

  const features500 = Array.isArray(geojson500) ? geojson500[0].features : geojson500.features;
  console.log(`Successfully parsed 500.zip -> ${features500.length} features!`);

  fs.writeFileSync(path.resolve('public/data/500.geojson'), JSON.stringify(Array.isArray(geojson500) ? geojson500[0] : geojson500));
  console.log('Saved public/data/500.geojson');

  const zip10kBuf = fs.readFileSync(path.resolve('public/data/10km.zip'));
  const geojson10k = await shp(zip10kBuf);

  const features10k = Array.isArray(geojson10k) ? geojson10k[0].features : geojson10k.features;
  console.log(`Successfully parsed 10km.zip -> ${features10k.length} features!`);

  fs.writeFileSync(path.resolve('public/data/10km.geojson'), JSON.stringify(Array.isArray(geojson10k) ? geojson10k[0] : geojson10k));
  console.log('Saved public/data/10km.geojson');

  console.log('Done converting both zip shapefiles to GeoJSON!');
}

main().catch(err => {
  console.error('Error parsing zip shapefile:', err);
  process.exit(1);
});
