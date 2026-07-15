import { type DatasetRaw, type DatasetRecord } from '@/types/dataset';

export function parseGeoJSON(jsonText: string): DatasetRaw {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON format: ${msg}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid GeoJSON input');
  }

  const geojsonObj = parsed as Record<string, unknown>;
  let features: Record<string, unknown>[] = [];

  if (geojsonObj.type === 'FeatureCollection') {
    features = Array.isArray(geojsonObj.features) ? (geojsonObj.features as Record<string, unknown>[]) : [];
  } else if (geojsonObj.type === 'Feature') {
    features = [geojsonObj];
  } else {
    throw new Error('Input JSON is not a valid GeoJSON Feature or FeatureCollection');
  }

  // Determine all unique property keys
  const propKeys = new Set<string>();
  for (const f of features) {
    const props = f.properties as Record<string, unknown> | undefined;
    if (props && typeof props === 'object') {
      Object.keys(props).forEach((k) => propKeys.add(k));
    }
  }

  const headers = Array.from(propKeys);
  headers.push('geometry'); // Include geometry column for coordinates representation

  const rows: DatasetRecord[] = features.map((f) => {
    const record: DatasetRecord = {};
    const props = f.properties as Record<string, unknown> | undefined;

    for (const key of headers) {
      if (key === 'geometry') continue;
      
      const val = props ? props[key] : undefined;
      if (val === undefined) {
        record[key] = null;
      } else if (typeof val === 'string') {
        const trimmed = val.trim();
        record[key] = trimmed === '' ? null : trimmed;
      } else {
        record[key] = val;
      }
    }

    record['geometry'] = f.geometry || null;
    return record;
  });

  return { headers, rows };
}
