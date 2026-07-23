import fs from 'fs';
import path from 'path';
import shp from 'shpjs';

async function convert() {
  console.log('Converting Space Syntax shapefiles to GeoJSON...');

  const dataDir = path.resolve('Data');
  const outDir = path.resolve('public/data');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Convert 500m
  const shp500 = fs.readFileSync(path.join(dataDir, '500.shp'));
  const dbf500 = fs.readFileSync(path.join(dataDir, '500.dbf'));
  const prj500 = fs.existsSync(path.join(dataDir, '500.prj')) ? fs.readFileSync(path.join(dataDir, '500.prj'), 'utf8') : undefined;

  const geojson500 = shp.combine([shp.parseShp(shp500, prj500), shp.parseDbf(dbf500)]);
  fs.writeFileSync(path.join(outDir, '500.geojson'), JSON.stringify(geojson500));
  console.log(`Converted 500m shapefile -> public/data/500.geojson (${(fs.statSync(path.join(outDir, '500.geojson')).size / 1024 / 1024).toFixed(2)} MB)`);

  // Convert 10km
  const shp10k = fs.readFileSync(path.join(dataDir, '10km.shp'));
  const dbf10k = fs.readFileSync(path.join(dataDir, '10km.dbf'));
  const prj10k = fs.existsSync(path.join(dataDir, '10km.prj')) ? fs.readFileSync(path.join(dataDir, '10km.prj'), 'utf8') : undefined;

  const geojson10k = shp.combine([shp.parseShp(shp10k, prj10k), shp.parseDbf(dbf10k)]);
  fs.writeFileSync(path.join(outDir, '10km.geojson'), JSON.stringify(geojson10k));
  console.log(`Converted 10km shapefile -> public/data/10km.geojson (${(fs.statSync(path.join(outDir, '10km.geojson')).size / 1024 / 1024).toFixed(2)} MB)`);

  console.log('Conversion complete!');
}

convert().catch((err) => {
  console.error('Conversion failed:', err);
  process.exit(1);
});
