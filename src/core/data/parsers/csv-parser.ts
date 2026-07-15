import Papa from 'papaparse';
import { type DatasetRaw, type DatasetRecord } from '@/types/dataset';

export function parseCSV(csvText: string): DatasetRaw {
  const result = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: 'greedy',
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(result.errors[0].message);
  }

  const data = result.data;
  if (data.length === 0) {
    return { headers: [], rows: [] };
  }

  // Extract and trim headers
  const rawHeaders = data[0].map((h) => h.trim() || 'unnamed_column');
  
  // De-duplicate header names to prevent key collisions
  const headers: string[] = [];
  const headerCounts: Record<string, number> = {};
  for (const h of rawHeaders) {
    if (headers.includes(h)) {
      headerCounts[h] = (headerCounts[h] || 1) + 1;
      headers.push(`${h}_${headerCounts[h]}`);
    } else {
      headers.push(h);
    }
  }

  // Parse remaining rows
  const rows: DatasetRecord[] = data.slice(1).map((row) => {
    const record: DatasetRecord = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const val = row[i];
      if (val === undefined) {
        record[header] = null;
        continue;
      }
      const trimmed = val.trim();
      record[header] = trimmed === '' ? null : trimmed;
    }
    return record;
  });

  return { headers, rows };
}
