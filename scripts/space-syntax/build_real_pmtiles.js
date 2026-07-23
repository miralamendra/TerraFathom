import fs from 'fs';
import path from 'path';
import geojsonvt from 'geojson-vt';
import vtpbf from 'vt-pbf';
import * as pmtiles from 'pmtiles';

function writeVarint(value) {
  const buf = [];
  while (value >= 0x80) {
    buf.push((value & 0x7f) | 0x80);
    value = Math.floor(value / 128);
  }
  buf.push(value & 0x7f);
  return Buffer.from(buf);
}

function serializeDirectory(entries) {
  const buffers = [];
  buffers.push(writeVarint(entries.length));
  
  let lastTileId = 0;
  for (const entry of entries) {
    buffers.push(writeVarint(entry.tileId - lastTileId));
    lastTileId = entry.tileId;
  }
  
  for (const entry of entries) {
    buffers.push(writeVarint(entry.runLength));
  }
  
  for (const entry of entries) {
    buffers.push(writeVarint(entry.length));
  }
  
  for (let i = 0; i < entries.length; i++) {
    if (i === 0) {
      buffers.push(writeVarint(entries[i].offset));
    } else {
      const diff = entries[i].offset - (entries[i - 1].offset + entries[i - 1].length);
      buffers.push(writeVarint(diff + 1));
    }
  }
  
  return Buffer.concat(buffers);
}

async function buildPMTilesForDataset(geojsonPath, outPath, layerName) {
  console.log(`\n======================================================`);
  console.log(`Processing GeoJSON -> PMTiles: ${path.basename(geojsonPath)}`);
  
  if (!fs.existsSync(geojsonPath)) {
    console.error('Missing input GeoJSON at:', geojsonPath);
    return;
  }

  const fileStats = fs.statSync(geojsonPath);
  console.log(`File Size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);

  const rawData = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
  const featureCount = rawData.features ? rawData.features.length : 0;
  console.log(`Loaded ${featureCount.toLocaleString()} features. Slicing vector tiles...`);

  const tileIndex = geojsonvt(rawData, {
    maxZoom: 15,
    indexMaxZoom: 14,
    indexMaxPoints: 0,
    tolerance: 0,
    extent: 4096,
    buffer: 64,
  });

  let minLon = 180, minLat = 90, maxLon = -180, maxLat = -90;
  for (const f of rawData.features) {
    if (!f.geometry || !f.geometry.coordinates) continue;
    const coords = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates.flat(2);
    for (let i = 0; i < coords.length; i += 2) {
      const lon = coords[i];
      const lat = coords[i + 1];
      if (typeof lon === 'number' && typeof lat === 'number') {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }

  if (minLon > maxLon) {
    minLon = 79.5; maxLon = 80.5; minLat = 6.3; maxLat = 7.4;
  }

  function lngToTileX(lng, zoom) {
    return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
  }

  function latToTileY(lat, zoom) {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(
      ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
    );
  }

  const tileEntries = [];
  const minZoom = 7;
  const maxZoom = 15;

  for (let z = minZoom; z <= maxZoom; z++) {
    const minX = Math.max(0, lngToTileX(minLon, z) - 1);
    const maxX = Math.min(Math.pow(2, z) - 1, lngToTileX(maxLon, z) + 1);
    const minY = Math.max(0, latToTileY(maxLat, z) - 1);
    const maxY = Math.min(Math.pow(2, z) - 1, latToTileY(minLat, z) + 1);

    let countAtZoom = 0;
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const tile = tileIndex.getTile(z, x, y);
        if (tile && tile.features && tile.features.length > 0) {
          const tileObj = {};
          tileObj[layerName] = tile;
          const pbf = vtpbf.fromGeojsonVt(tileObj);
          tileEntries.push({ z, x, y, pbf });
          countAtZoom++;
        }
      }
    }
    console.log(`Zoom Level ${z}: generated ${countAtZoom.toLocaleString()} tiles.`);
  }

  console.log(`Total vector tiles generated across zooms ${minZoom}-${maxZoom}: ${tileEntries.length.toLocaleString()}`);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  let tileDataOffset = 0;
  const tileBuffers = [];
  for (const entry of tileEntries) {
    const buf = Buffer.from(entry.pbf);
    entry.offset = tileDataOffset;
    entry.length = buf.length;
    tileBuffers.push(buf);
    tileDataOffset += buf.length;
  }
  const combinedTileData = Buffer.concat(tileBuffers);

  const metadata = JSON.stringify({
    name: layerName,
    format: 'mvt',
    type: 'overlay',
    version: '1.0.0',
    description: `Space Syntax ${layerName} dataset for Colombo & Western Province`,
    vector_layers: [
      {
        id: layerName,
        fields: {
          segment_id: 'Number',
          BtA500: 'Number',
          BtA10000: 'Number',
          NQPDA500: 'Number',
          MAD500: 'Number',
          choice_10k: 'Number',
          integration_10k: 'Number'
        }
      }
    ]
  });

  const metadataBuf = Buffer.from(metadata, 'utf8');

  const rawEntries = tileEntries.map(e => ({
    tileId: pmtiles.zxyToTileId(e.z, e.x, e.y),
    runLength: 1,
    length: e.length,
    offset: e.offset
  }));
  rawEntries.sort((a, b) => (a.tileId < b.tileId ? -1 : 1));

  const dirBuf = serializeDirectory(rawEntries);

  const header = {
    specVersion: 3,
    rootDirectoryOffset: 127,
    rootDirectoryLength: dirBuf.length,
    jsonMetadataOffset: 127 + dirBuf.length,
    jsonMetadataLength: metadataBuf.length,
    leafDirectoryOffset: 127 + dirBuf.length + metadataBuf.length,
    leafDirectoryLength: 0,
    tileDataOffset: 127 + dirBuf.length + metadataBuf.length,
    tileDataLength: combinedTileData.length,
    numAddressedTiles: tileEntries.length,
    numTileEntries: tileEntries.length,
    numTileContents: tileEntries.length,
    clustered: true,
    internalCompression: 0,
    tileCompression: 0,
    tileType: 1,
    minZoom,
    maxZoom,
    minLon,
    minLat,
    maxLon,
    maxLat,
    centerZoom: 11,
    centerLon: (minLon + maxLon) / 2,
    centerLat: (minLat + maxLat) / 2,
  };

  const headerBuf = Buffer.alloc(127);
  headerBuf.write('PMTiles', 0, 7, 'ascii');
  headerBuf.writeUInt8(header.specVersion, 7);
  headerBuf.writeBigUInt64LE(BigInt(header.rootDirectoryOffset), 8);
  headerBuf.writeBigUInt64LE(BigInt(header.rootDirectoryLength), 16);
  headerBuf.writeBigUInt64LE(BigInt(header.jsonMetadataOffset), 24);
  headerBuf.writeBigUInt64LE(BigInt(header.jsonMetadataLength), 32);
  headerBuf.writeBigUInt64LE(BigInt(header.leafDirectoryOffset), 40);
  headerBuf.writeBigUInt64LE(BigInt(header.leafDirectoryLength), 48);
  headerBuf.writeBigUInt64LE(BigInt(header.tileDataOffset), 56);
  headerBuf.writeBigUInt64LE(BigInt(header.tileDataLength), 64);
  headerBuf.writeBigUInt64LE(BigInt(header.numAddressedTiles), 72);
  headerBuf.writeBigUInt64LE(BigInt(header.numTileEntries), 80);
  headerBuf.writeBigUInt64LE(BigInt(header.numTileContents), 88);
  headerBuf.writeUInt8(header.clustered ? 1 : 0, 96);
  headerBuf.writeUInt8(header.internalCompression, 97);
  headerBuf.writeUInt8(header.tileCompression, 98);
  headerBuf.writeUInt8(header.tileType, 99);
  headerBuf.writeUInt8(header.minZoom, 100);
  headerBuf.writeUInt8(header.maxZoom, 101);
  headerBuf.writeInt32LE(Math.round(header.minLon * 10000000), 102);
  headerBuf.writeInt32LE(Math.round(header.minLat * 10000000), 106);
  headerBuf.writeInt32LE(Math.round(header.maxLon * 10000000), 110);
  headerBuf.writeInt32LE(Math.round(header.maxLat * 10000000), 114);
  headerBuf.writeUInt8(header.centerZoom, 118);
  headerBuf.writeInt32LE(Math.round(header.centerLon * 10000000), 119);
  headerBuf.writeInt32LE(Math.round(header.centerLat * 10000000), 123);

  const finalPMTiles = Buffer.concat([headerBuf, dirBuf, metadataBuf, combinedTileData]);
  fs.writeFileSync(outPath, finalPMTiles);

  const finalSizeMB = (finalPMTiles.length / 1024 / 1024).toFixed(2);
  console.log(`\nSuccessfully built PMTiles container: ${outPath} (${finalSizeMB} MB)`);
  console.log(`======================================================\n`);
}

async function main() {
  const data500 = path.join(process.cwd(), 'public/data/500.geojson');
  const data10k = path.join(process.cwd(), 'public/data/10km.geojson');

  if (fs.existsSync(data500)) {
    await buildPMTilesForDataset(data500, path.join(process.cwd(), 'public/data/space-syntax-500.pmtiles'), 'space_syntax');
  }

  if (fs.existsSync(data10k)) {
    await buildPMTilesForDataset(data10k, path.join(process.cwd(), 'public/data/space-syntax-10k.pmtiles'), 'space_syntax');
  }
}

main().catch(console.error);
