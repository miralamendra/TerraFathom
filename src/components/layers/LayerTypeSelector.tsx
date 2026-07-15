import { CircleDot, Hexagon, GitCommit, Flame, Layers } from 'lucide-react';
import { useDataStore } from '@/stores/data-store';
import { useLayerStore } from '@/stores/layer-store';
import { LAYER_DEFINITIONS } from '@/core/layers/layer-registry';
import { type LayerType } from '@/core/layers/base-layer';
import { Button } from '@/components/ui';
import { toast } from 'sonner';

const ICON_MAP = {
  scatterplot: CircleDot,
  hexagon: Hexagon,
  arc: GitCommit,
  heatmap: Flame,
  geojson: Layers,
};

export function LayerTypeSelector() {
  const selectedDatasetId = useDataStore((s) => s.selectedDatasetId);
  const datasets = useDataStore((s) => s.datasets);
  const addLayer = useLayerStore((s) => s.addLayer);

  const activeDataset = selectedDatasetId ? datasets[selectedDatasetId] : null;

  const handleCreateLayer = (type: LayerType, label: string) => {
    if (!selectedDatasetId) {
      toast.error('Please select or load a dataset first.');
      return;
    }
    
    // Auto-generate a clean default name
    const layerName = `${activeDataset?.name || 'Dataset'} ${label}`;
    addLayer(selectedDatasetId, type, layerName);
    toast.success(`Created layer: ${layerName}`);
  };

  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-border-primary/40 mt-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
        <span>Add Visualization Layer</span>
      </div>

      {!activeDataset ? (
        <p className="text-[11px] text-text-tertiary text-center py-2 leading-relaxed">
          Select a dataset above to create visual layers.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-1.5">
          {Object.values(LAYER_DEFINITIONS).map((def) => {
            const Icon = ICON_MAP[def.type];
            const isCompatible = def.validateDataset(activeDataset);

            return (
              <Button
                key={def.type}
                size="sm"
                variant="secondary"
                disabled={!isCompatible}
                onClick={() => handleCreateLayer(def.type, def.label)}
                className="w-full justify-between items-center text-xs h-8 px-2 font-normal"
                title={isCompatible ? `Create a ${def.label} layer` : 'Incompatible with this dataset geometry'}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon size={14} className={isCompatible ? 'text-accent' : 'text-text-tertiary'} />
                  <span className="truncate">{def.label}</span>
                </div>
                {!isCompatible && (
                  <span className="text-[10px] text-text-tertiary bg-bg-secondary/60 px-1.5 py-0.5 rounded-sm">
                    Incompatible
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default LayerTypeSelector;
