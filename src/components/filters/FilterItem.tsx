import { Trash2, AlertCircle } from 'lucide-react';
import { useFilterStore } from '@/stores/filter-store';
import { type Filter } from '@/core/filters/filter-types';
import { type ProcessedDataset } from '@/types/dataset';
import { Switch } from '@/components/ui';
import { RangeFilter } from './RangeFilter';
import { ValueFilter } from './ValueFilter';

export interface FilterItemProps {
  filter: Filter;
  dataset: ProcessedDataset;
}

export function FilterItem({ filter, dataset }: FilterItemProps) {
  const removeFilter = useFilterStore((s) => s.removeFilter);
  const updateValue = useFilterStore((s) => s.updateFilterValue);
  const toggleActive = useFilterStore((s) => s.toggleFilterActive);

  const stats = dataset.fields.find((f) => f.name === filter.fieldName);

  if (!stats) {
    return (
      <div className="p-3 bg-error/10 border border-error/25 rounded-md text-xs text-error flex items-center gap-2">
        <AlertCircle size={14} />
        <span>Column "{filter.fieldName}" not found in dataset.</span>
      </div>
    );
  }

  const handleRangeChange = (val: [number, number]) => {
    updateValue(filter.id, val);
  };

  const handleValueChange = (val: (string | number | boolean | null)[]) => {
    updateValue(filter.id, val);
  };

  return (
    <div className="flex flex-col gap-2 font-sans text-xs">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-text-primary truncate" title={filter.fieldName}>
            {filter.fieldName}
          </span>
          <span className="text-[10px] text-text-tertiary select-none font-mono">
            ({filter.type})
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Switch
            id={`toggle-${filter.id}`}
            checked={filter.active}
            onChange={() => toggleActive(filter.id)}
          />
          <button
            type="button"
            onClick={() => removeFilter(filter.id)}
            className="text-text-tertiary hover:text-error transition-colors p-1 rounded hover:bg-bg-hover cursor-pointer"
            title="Remove filter"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Filter Body Controls */}
      {filter.active ? (
        <div className="animate-fade-in">
          {filter.type === 'range' && typeof stats.min === 'number' && typeof stats.max === 'number' ? (
            <RangeFilter
              min={stats.min}
              max={stats.max}
              value={filter.value as [number, number]}
              onChange={handleRangeChange}
            />
          ) : filter.type === 'value' ? (
            <ValueFilter
              uniqueValues={stats.uniqueValues}
              value={filter.value as (string | number | boolean | null)[]}
              onChange={handleValueChange}
            />
          ) : (
            <p className="text-[10px] text-text-tertiary text-center py-2">
              Invalid column stats for filter
            </p>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-text-tertiary py-0.5">Filter is currently disabled.</p>
      )}
    </div>
  );
}
export default FilterItem;
