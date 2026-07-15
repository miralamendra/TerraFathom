export type FieldType = 'boolean' | 'integer' | 'real' | 'string' | 'timestamp' | 'geojson';

export interface FieldStats {
  name: string;
  type: FieldType;
  min: number | string | null;
  max: number | string | null;
  uniqueValues: (string | number | boolean | null)[];
  count: number;
}

export type DatasetRecord = Record<string, string | number | boolean | null | unknown>;

export interface DatasetRaw {
  headers: string[];
  rows: DatasetRecord[];
}

export interface ProcessedDataset {
  id: string;
  name: string;
  color: string; // Custom dataset badge color indicator
  format: 'csv' | 'geojson';
  fields: FieldStats[];
  records: DatasetRecord[];
  latField?: string;
  lngField?: string;
  bounds: [number, number, number, number] | null; // [minLng, minLat, maxLng, maxLat]
  rowCount: number;
}
