import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useFilterStore } from '@/stores/filter-store';
import { useDataStore } from '@/stores/data-store';
import { useUIStore } from '@/stores/ui-store';
import { Button, Select, Divider } from '@/components/ui';
import { FilterItem } from './FilterItem';

export function FilterList() {
  const datasets = useDataStore((s) => s.datasets);
  const selectedDatasetId = useUIStore((s) => s.selectedDatasetId);
  const setSelectedDatasetId = useUIStore((s) => s.setSelectedDatasetId);

  const filters = useFilterStore((s) => s.filters);
  const addFilter = useFilterStore((s) => s.addFilter);

  const [selectedColumnName, setSelectedColumnName] = useState('');

  const datasetList = Object.values(datasets);
  const activeDatasetId = selectedDatasetId || (datasetList[0]?.id ?? '');

  const activeDataset = datasets[activeDatasetId];

  // Filters belonging to the currently active dataset
  const activeDatasetFilters = filters.filter((f) => f.datasetId === activeDatasetId);

  const handleAddFilter = () => {
    if (!activeDataset || !selectedColumnName) return;

    const stats = activeDataset.fields.find((f) => f.name === selectedColumnName);
    if (!stats) return;

    // Check if filter already exists
    const exists = activeDatasetFilters.some((f) => f.fieldName === selectedColumnName);
    if (exists) {
      setSelectedColumnName('');
      return;
    }

    if (stats.type === 'integer' || stats.type === 'real') {
      const min = typeof stats.min === 'number' ? stats.min : 0;
      const max = typeof stats.max === 'number' ? stats.max : 100;
      addFilter(activeDatasetId, selectedColumnName, 'range', [min, max]);
    } else {
      addFilter(activeDatasetId, selectedColumnName, 'value', [...stats.uniqueValues]);
    }

    setSelectedColumnName('');
  };

  if (datasetList.length === 0) {
    return (
      <div className="text-center text-text-tertiary p-6 text-xs flex flex-col items-center gap-2 mt-4 select-none">
        <span>No datasets available. Load a dataset to begin adding search filters.</span>
      </div>
    );
  }

  // Filter columns that don't already have filters applied
  const filterableColumns = activeDataset
    ? activeDataset.fields
        .filter((f) => f.name !== 'geometry' && !activeDatasetFilters.some((fil) => fil.fieldName === f.name))
        .map((f) => ({ value: f.name, label: `${f.name} (${f.type})` }))
    : [];

  return (
    <div className="flex flex-col gap-5 font-sans text-xs p-1">
      {/* Target Dataset Selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
          Target Dataset
        </label>
        <Select
          options={datasetList.map((d) => ({ value: d.id, label: d.name }))}
          value={activeDatasetId}
          onChange={(e) => setSelectedDatasetId(e.target.value)}
        />
      </div>

      <Divider />

      {/* Add New Filter */}
      {filterableColumns.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
            Create Filter
          </span>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <Select
                options={[{ value: '', label: 'Choose column...' }, ...filterableColumns]}
                value={selectedColumnName}
                onChange={(e) => setSelectedColumnName(e.target.value)}
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddFilter}
              disabled={!selectedColumnName}
              className="shrink-0 h-8 w-8 flex items-center justify-center p-0 rounded-md cursor-pointer"
              title="Add Filter"
            >
              <Plus size={16} />
            </Button>
          </div>
        </div>
      ) : activeDataset ? (
        <div className="py-2 text-text-tertiary text-xs">
          All columns have filters applied.
        </div>
      ) : null}

      <Divider />

      {/* List of Applied Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
            Applied Filters
          </span>
          <span className="text-xs text-text-secondary bg-bg-tertiary px-1.5 py-0.5 rounded-sm border border-border-primary/45">
            {activeDatasetFilters.length} Active
          </span>
        </div>

        {activeDatasetFilters.length === 0 ? (
          <div className="text-center text-text-tertiary py-6 text-xs bg-bg-tertiary/10 rounded-md border border-dashed border-border-primary/40">
            No active filters. Add a filter above to constrain this dataset.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {activeDatasetFilters.map((filter) => (
              <FilterItem key={filter.id} filter={filter} dataset={activeDataset} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export default FilterList;
