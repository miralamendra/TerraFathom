import { type FieldType, type FieldStats, type DatasetRecord } from '@/types/dataset';

const isBool = (val: unknown): boolean => {
  if (typeof val === 'boolean') return true;
  if (typeof val === 'string') {
    const l = val.toLowerCase().trim();
    return l === 'true' || l === 'false' || l === 'yes' || l === 'no' || l === '1' || l === '0';
  }
  return false;
};

const isInteger = (val: unknown): boolean => {
  if (typeof val === 'number') return Number.isInteger(val);
  if (typeof val === 'string') {
    return /^-?\d+$/.test(val.trim());
  }
  return false;
};

const isReal = (val: unknown): boolean => {
  if (typeof val === 'number') return !isNaN(val);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return /^-?\d*(\.\d+)?$/.test(trimmed) && !isNaN(parseFloat(trimmed));
  }
  return false;
};

const isTimestamp = (val: unknown): boolean => {
  if (val instanceof Date) return true;
  if (typeof val === 'string') {
    const s = val.trim();
    // Match common ISO-like date patterns to avoid classifying short digits like "1" or "20" as dates
    if (/^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{2}\/\d{2}\/\d{4}/.test(s) || (s.includes(':') && !isNaN(Date.parse(s)))) {
      return !isNaN(Date.parse(s));
    }
  }
  return false;
};

export function analyzeFields(headers: string[], rows: DatasetRecord[]): { fields: FieldStats[]; convertedRows: DatasetRecord[] } {
  const fields: FieldStats[] = [];
  const convertedRows: DatasetRecord[] = rows.map((r) => ({ ...r }));

  for (const header of headers) {
    if (header === 'geometry') {
      fields.push({
        name: header,
        type: 'geojson',
        min: null,
        max: null,
        uniqueValues: [],
        count: rows.filter((r) => r[header] !== null).length,
      });
      continue;
    }

    // Determine the field type by sampling non-null values
    const nonNullValues = rows
      .map((r) => r[header])
      .filter((v) => v !== null && v !== undefined && v !== '');

    let detectedType: FieldType = 'string';
    if (nonNullValues.length > 0) {
      const isAllBool = nonNullValues.every(isBool);
      const isAllInt = nonNullValues.every(isInteger);
      const isAllReal = nonNullValues.every(isReal);
      const isAllTime = nonNullValues.every(isTimestamp);

      if (isAllBool) {
        detectedType = 'boolean';
      } else if (isAllInt) {
        detectedType = 'integer';
      } else if (isAllReal) {
        detectedType = 'real';
      } else if (isAllTime) {
        detectedType = 'timestamp';
      }
    }

    // Convert values and calculate stats
    let min: number | string | null = null;
    let max: number | string | null = null;
    const uniqueSet = new Set<string | number | boolean>();

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const val = rows[rowIndex][header];
      if (val === null || val === undefined || val === '') {
        convertedRows[rowIndex][header] = null;
        continue;
      }

      let converted: string | number | boolean | null = null;
      if (detectedType === 'boolean') {
        const strVal = String(val).toLowerCase().trim();
        converted = strVal === 'true' || strVal === '1' || strVal === 'yes';
      } else if (detectedType === 'integer') {
        converted = parseInt(String(val).trim(), 10);
      } else if (detectedType === 'real') {
        converted = parseFloat(String(val).trim());
      } else if (detectedType === 'timestamp') {
        const timeVal = Date.parse(val instanceof Date ? val.toISOString() : String(val).trim());
        converted = isNaN(timeVal) ? String(val) : new Date(timeVal).toISOString();
      } else {
        converted = String(val).trim();
      }

      convertedRows[rowIndex][header] = converted;

      if (converted !== null) {
        if (typeof converted === 'number') {
          if (min === null || converted < (min as number)) min = converted;
          if (max === null || converted > (max as number)) max = converted;
        } else if (typeof converted === 'string') {
          if (min === null || converted < (min as string)) min = converted;
          if (max === null || converted > (max as string)) max = converted;
        }
        
        if (uniqueSet.size < 50) {
          uniqueSet.add(converted);
        }
      }
    }

    fields.push({
      name: header,
      type: detectedType,
      min,
      max,
      uniqueValues: Array.from(uniqueSet) as (string | number | boolean | null)[],
      count: nonNullValues.length,
    });
  }

  return { fields, convertedRows };
}
