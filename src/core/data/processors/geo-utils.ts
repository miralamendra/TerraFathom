import bbox from '@turf/bbox';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { type DatasetRecord } from '@/types/dataset';

// Heuristics for latitude / longitude headers (matching pickup_latitude, dropoff_longitude, etc.)
const LAT_REGEX = /(lat|latitude|lat_y|^y$|lat_y_coord)/i;
const LNG_REGEX = /(lng|lon|longitude|lng_x|^x$|lng_x_coord)/i;
const GEOM_REGEX = /(geojson|geom|_geometry)/i;

export function detectCoordinates(headers: string[], rows: DatasetRecord[]): { latField?: string; lngField?: string } {
  let latField: string | undefined;
  let lngField: string | undefined;

  // Find candidate latitude fields
  for (const h of headers) {
    if (LAT_REGEX.test(h)) {
      // Perform simple range check on first few rows to verify
      const sample = rows
        .slice(0, 50)
        .map((r) => Number(r[h]))
        .filter((n) => !isNaN(n));
      const isValidRange = sample.every((n) => n >= -90 && n <= 90);
      if (isValidRange) {
        latField = h;
        break;
      }
    }
  }

  // Find candidate longitude fields
  for (const h of headers) {
    if (LNG_REGEX.test(h)) {
      const sample = rows
        .slice(0, 50)
        .map((r) => Number(r[h]))
        .filter((n) => !isNaN(n));
      const isValidRange = sample.every((n) => n >= -180 && n <= 180);
      if (isValidRange) {
        lngField = h;
        break;
      }
    }
  }

  return { latField, lngField };
}

export function computeBounds(
  records: DatasetRecord[],
  format: 'csv' | 'geojson' | 'shp',
  latField?: string,
  lngField?: string
): [number, number, number, number] | null {
  if (format === 'geojson' || format === 'shp') {
    // Collect all valid geometries
    const features: Feature[] = [];
    for (const r of records) {
      const geom = r.geometry as Geometry | undefined;
      if (geom && typeof geom === 'object' && geom.type) {
        features.push({
          type: 'Feature',
          geometry: geom,
          properties: {},
        });
      }
    }

    if (features.length === 0) return null;

    try {
      const fc: FeatureCollection = {
        type: 'FeatureCollection',
        features,
      };
      const box = bbox(fc);
      // Ensure bounding box values are finite and valid
      if (box.every(isFinite)) {
        return box as [number, number, number, number];
      }
    } catch {
      return null;
    }
  } else if (format === 'csv') {
    if (latField && lngField) {
      let minLng = Infinity;
      let minLat = Infinity;
      let maxLng = -Infinity;
      let maxLat = -Infinity;
      let validPointsCount = 0;

      for (const r of records) {
        const lat = Number(r[latField]);
        const lng = Number(r[lngField]);

        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          if (lng < minLng) minLng = lng;
          if (lat < minLat) minLat = lat;
          if (lng > maxLng) maxLng = lng;
          if (lat > maxLat) maxLat = lat;
          validPointsCount++;
        }
      }

      if (validPointsCount > 0) {
        return [minLng, minLat, maxLng, maxLat];
      }
    }

    // Heuristics: Fallback to GeoJSON geom columns inside CSV (like Pittsburgh Movement's X_geojson)
    const headers = records.length > 0 ? Object.keys(records[0]) : [];
    const geomHeader = headers.find((h) => GEOM_REGEX.test(h));
    if (geomHeader) {
      const features: Feature[] = [];
      for (const r of records) {
        const rawStr = r[geomHeader];
        if (typeof rawStr === 'string' && rawStr.trim() !== '') {
          try {
            const parsed = JSON.parse(rawStr);
            if (parsed && typeof parsed === 'object') {
              if (parsed.type === 'Feature') {
                features.push(parsed);
              } else if (parsed.type) {
                features.push({
                  type: 'Feature',
                  geometry: parsed,
                  properties: {},
                });
              }
            }
          } catch {
            // ignore
          }
        } else if (rawStr && typeof rawStr === 'object') {
          features.push({
            type: 'Feature',
            geometry: rawStr as any,
            properties: {},
          });
        }
      }

      if (features.length > 0) {
        try {
          const fc: FeatureCollection = {
            type: 'FeatureCollection',
            features,
          };
          const box = bbox(fc);
          if (box.every(isFinite)) {
            return box as [number, number, number, number];
          }
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}
