import { useDataStore } from '@/stores/data-store';
import { DatasetItem } from './DatasetItem';

export function DatasetList() {
  const datasets = useDataStore((s) => s.datasets);
  const selectedId = useDataStore((s) => s.selectedDatasetId);
  const selectDataset = useDataStore((s) => s.selectDataset);
  const removeDataset = useDataStore((s) => s.removeDataset);

  const datasetList = Object.values(datasets);

  if (datasetList.length === 0) {
    return (
      <div className="py-4 text-center select-none">
        <span className="text-xs text-text-tertiary leading-relaxed">No datasets loaded yet.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {datasetList.map((dataset) => (
        <DatasetItem
          key={dataset.id}
          dataset={dataset}
          selected={selectedId === dataset.id}
          onSelect={() => selectDataset(dataset.id)}
          onRemove={() => removeDataset(dataset.id)}
        />
      ))}
    </div>
  );
}
export default DatasetList;
