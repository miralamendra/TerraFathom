import { type DatasetRecord } from '@/types/dataset';
import { type Filter } from './filter-types';

export function applyFilters(records: DatasetRecord[], filters: Filter[]): DatasetRecord[] {
  const activeFilters = filters.filter((f) => f.active);
  if (activeFilters.length === 0) return records;

  return records.filter((row) => {
    for (const filter of activeFilters) {
      const val = row[filter.fieldName];

      if (filter.type === 'range') {
        const [min, max] = filter.value as [number, number];
        if (val === null || val === undefined || val === '') {
          return false;
        }
        const numVal = Number(val);
        if (isNaN(numVal) || numVal < min || numVal > max) {
          return false;
        }
      } else if (filter.type === 'value') {
        const allowedValues = filter.value as (string | number | boolean | null)[];
        const valToCompare = val as string | number | boolean | null;
        if (!allowedValues.includes(valToCompare)) {
          return false;
        }
      }
    }
    return true;
  });
}
