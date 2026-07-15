import { parseCSV } from '../parsers/csv-parser';
import { parseGeoJSON } from '../parsers/geojson-parser';
import { analyzeFields } from './field-analyzer';
import { detectCoordinates, computeBounds } from './geo-utils';
import { type ProcessedDataset } from '@/types/dataset';

export function processDataset(
  name: string,
  rawContent: string,
  format: 'csv' | 'geojson',
  color: string
): ProcessedDataset {
  const id = `${format}-${Math.random().toString(36).substring(2, 11)}`;

  // 1. Parse raw content
  const rawDataset = format === 'csv' ? parseCSV(rawContent) : parseGeoJSON(rawContent);

  // 2. Type detection and value casting
  const { fields, convertedRows } = analyzeFields(rawDataset.headers, rawDataset.rows);

  // Assign a unique row index to each record
  for (let i = 0; i < convertedRows.length; i++) {
    convertedRows[i]['__id'] = i;
  }

  // 3. Heuristic coordinate parsing for CSV files
  let latField: string | undefined;
  let lngField: string | undefined;
  
  if (format === 'csv') {
    const coords = detectCoordinates(rawDataset.headers, convertedRows);
    latField = coords.latField;
    lngField = coords.lngField;

    // If no coordinates are detected, check if there is a GeoJSON geometry field
    if (!latField || !lngField) {
      const GEOM_REGEX = /(geojson|geom|_geometry)/i;
      const geomHeader = rawDataset.headers.find((h) => GEOM_REGEX.test(h));
      if (geomHeader) {
        let virtualLatFound = false;
        let virtualLngFound = false;

        for (let i = 0; i < convertedRows.length; i++) {
          const rawStr = convertedRows[i][geomHeader];
          if (typeof rawStr === 'string' && rawStr.trim() !== '') {
            try {
              const parsed = JSON.parse(rawStr);
              if (parsed && typeof parsed === 'object') {
                let geom = parsed.geometry;
                if (parsed.type && !parsed.geometry && parsed.coordinates) {
                  geom = parsed;
                }
                
                if (geom && geom.coordinates) {
                  let minLng = Infinity;
                  let minLat = Infinity;
                  let maxLng = -Infinity;
                  let maxLat = -Infinity;

                  const traverse = (c: any) => {
                    if (Array.isArray(c) && typeof c[0] === 'number') {
                      const lng = c[0];
                      const lat = c[1];
                      if (lng < minLng) minLng = lng;
                      if (lat < minLat) minLat = lat;
                      if (lng > maxLng) maxLng = lng;
                      if (lat > maxLat) maxLat = lat;
                    } else if (Array.isArray(c)) {
                      c.forEach(traverse);
                    }
                  };
                  traverse(geom.coordinates);

                  if (isFinite(minLng) && isFinite(minLat) && isFinite(maxLng) && isFinite(maxLat)) {
                    convertedRows[i]['latitude'] = (minLat + maxLat) / 2;
                    convertedRows[i]['longitude'] = (minLng + maxLng) / 2;
                    virtualLatFound = true;
                    virtualLngFound = true;
                  }
                }
              }
            } catch {
              // ignore invalid JSON in rows
            }
          }
        }

        if (virtualLatFound && virtualLngFound) {
          latField = 'latitude';
          lngField = 'longitude';
          
          // Inject stats for virtual fields
          const latValues = convertedRows.map(r => r['latitude'] as number).filter(v => v !== null && v !== undefined);
          const lngValues = convertedRows.map(r => r['longitude'] as number).filter(v => v !== null && v !== undefined);
          
          fields.push({
            name: 'latitude',
            type: 'real',
            min: Math.min(...latValues),
            max: Math.max(...latValues),
            uniqueValues: [],
            count: latValues.length,
          });
          fields.push({
            name: 'longitude',
            type: 'real',
            min: Math.min(...lngValues),
            max: Math.max(...lngValues),
            uniqueValues: [],
            count: lngValues.length,
          });
        }
      }
    }
  }

  // 4. Bounding Box calculations
  const bounds = computeBounds(convertedRows, format, latField, lngField);

  return {
    id,
    name,
    color,
    format,
    fields,
    records: convertedRows,
    latField,
    lngField,
    bounds,
    rowCount: convertedRows.length,
  };
}
