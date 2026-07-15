import { useLayerStore } from '@/stores/layer-store';
import { useDataStore } from '@/stores/data-store';
import { LayerEditor } from './LayerEditor';
import { useUIStore } from '@/stores/ui-store';

export function LayerInspector() {
  const selectedLayerId = useLayerStore((s) => s.selectedLayerId);
  const layers = useLayerStore((s) => s.layers);
  const datasets = useDataStore((s) => s.datasets);
  const rightOpen = useUIStore((s) => s.rightPanelOpen);
  const rightWidth = useUIStore((s) => s.rightPanelWidth);

  if (!rightOpen || !selectedLayerId) return null;

  const layer = layers.find((l) => l.id === selectedLayerId);
  if (!layer) return null;

  const dataset = datasets[layer.datasetId];
  if (!dataset) return null;

  return (
    <aside
      className="h-full flex flex-col bg-bg-secondary select-none shrink-0 relative"
      style={{ width: rightWidth }}
    >
      <LayerEditor layer={layer} dataset={dataset} />
    </aside>
  );
}
export default LayerInspector;

