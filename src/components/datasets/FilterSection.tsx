import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useDataStore } from '@/stores/data-store';
import { useFilterStore } from '@/stores/filter-store';
import { useUIStore } from '@/stores/ui-store';
import { FilterItem } from '@/components/filters/FilterItem';
import { Select } from '@/components/ui';
import { cn } from '@/components/ui/utils';

export function FilterSection() {
  const datasets = useDataStore((s) => s.datasets);
  const filters = useFilterStore((s) => s.filters);
  const addFilter = useFilterStore((s) => s.addFilter);

  const selectedDatasetId = useUIStore((s) => s.selectedDatasetId);
  const setSelectedDatasetId = useUIStore((s) => s.setSelectedDatasetId);

  const datasetList = Object.values(datasets);
  const activeDatasetId = selectedDatasetId || datasetList[0]?.id;
  const activeDataset = activeDatasetId ? datasets[activeDatasetId] : null;
  const activeFilters = activeDataset ? filters.filter((f) => f.datasetId === activeDatasetId) : [];

  const [showAdd, setShowAdd] = useState(false);
  const [pickedField, setPickedField] = useState('');

  if (datasetList.length === 0) return null;

  const filterableColumns = activeDataset
    ? activeDataset.fields
        .filter((f) => f.name !== 'geometry' && !activeFilters.some((fil) => fil.fieldName === f.name))
        .map((f) => ({ value: f.name, label: f.name, type: f.type }))
    : [];

  const handleAdd = () => {
    if (!activeDataset || !pickedField) return;
    const stats = activeDataset.fields.find((f) => f.name === pickedField);
    if (!stats) return;
    if (stats.type === 'integer' || stats.type === 'real') {
      const min = typeof stats.min === 'number' ? stats.min : 0;
      const max = typeof stats.max === 'number' ? stats.max : 100;
      addFilter(activeDataset.id, pickedField, 'range', [min, max]);
    } else {
      addFilter(activeDataset.id, pickedField, 'value', [...stats.uniqueValues]);
    }
    setPickedField('');
    setShowAdd(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Dataset chooser (only when more than one) */}
      {datasetList.length > 1 && (
        <Select
          value={activeDatasetId || ''}
          onChange={(e) => setSelectedDatasetId(e.target.value)}
          options={datasetList.map((d) => ({ value: d.id, label: d.name }))}
        />
      )}

      {/* Filters list */}
      {activeFilters.length === 0 && !showAdd && (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="w-full h-7 flex items-center justify-center gap-1.5 text-[11px] text-text-secondary hover:text-text-primary bg-bg-tertiary/40 hover:bg-bg-hover rounded-control transition-all"
        >
          <Plus size={11} />
          <span>Add filter</span>
        </button>
      )}

      <div className="flex flex-col gap-2">
        {activeFilters.map((filter) => activeDataset && (
          <div key={filter.id} className="px-1 py-2 border-b border-border-secondary last:border-b-0">
            <FilterItem filter={filter} dataset={activeDataset} />
          </div>
        ))}
      </div>

      {/* Add bar */}
      {showAdd && (
        <div className="flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            <Select
              value={pickedField}
              onChange={(e) => setPickedField(e.target.value)}
              options={[{ value: '', label: 'Pick a column…' }, ...filterableColumns.map((c) => ({ value: c.value, label: c.label }))]}
            />
          </div>
          <button
            type="button"
            disabled={!pickedField}
            onClick={handleAdd}
            className={cn(
              'h-8 px-2.5 rounded-control bg-accent text-text-inverse text-[11px] font-semibold transition-colors',
              'hover:bg-accent-hover disabled:opacity-40 disabled:pointer-events-none'
            )}
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => { setShowAdd(false); setPickedField(''); }}
            className="h-8 w-8 rounded-control text-text-secondary hover:text-text-primary hover:bg-bg-hover flex items-center justify-center"
            title="Cancel"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {!showAdd && activeFilters.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="w-full h-7 flex items-center justify-center gap-1.5 text-[11px] text-text-secondary hover:text-text-primary bg-bg-tertiary/40 hover:bg-bg-hover rounded-control transition-all"
        >
          <Plus size={11} />
          <span>Add another</span>
        </button>
      )}
    </div>
  );
}
export default FilterSection;
