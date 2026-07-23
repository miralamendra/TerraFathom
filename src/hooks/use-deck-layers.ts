import { Layer } from 'deck.gl';
import { useLayerStore } from '@/stores/layer-store';
import { useDataStore } from '@/stores/data-store';
import { useFilterStore } from '@/stores/filter-store';
import { getLayerDefinition } from '@/core/layers/layer-registry';
import { applyFilters } from '@/core/filters/filter-engine';
import { useAnimationStore } from '@/stores/animation-store';

// Global cache for parsed date and numeric strings to prevent performance stutters on animation ticks
const parseCache = new Map<any, number>();

export function useDeckLayers(): Layer[] {
  const layers = useLayerStore((s) => s.layers);
  const datasets = useDataStore((s) => s.datasets);
  const filters = useFilterStore((s) => s.filters);
  const selectedDatasetId = useDataStore((s) => s.selectedDatasetId);

  // Read current animation state to trigger re-renders on tick
  const animationField = useAnimationStore((s) => s.timeField);
  const currentTime = useAnimationStore((s) => s.currentTime);
  const windowSize = useAnimationStore((s) => s.windowSize);

  const deckLayers: Layer[] = [];

  for (const layer of layers) {
    if (!layer.config.visible) continue;

    const dataset = datasets[layer.datasetId];
    if (!dataset || dataset.isPMTiles) continue;

    const def = getLayerDefinition(layer.type);
    if (!def) continue;

    try {
      // Find active filters for this dataset
      const datasetFilters = filters.filter((f) => f.datasetId === layer.datasetId);
      let filteredRecords = applyFilters(dataset.records, datasetFilters);

      // Apply animation playback filters if active
      if (animationField && layer.datasetId === selectedDatasetId) {
        const fieldStats = dataset.fields.find((f) => f.name === animationField);
        filteredRecords = filteredRecords.filter((record) => {
          const val = record[animationField];
          if (val === null || val === undefined) return false;

          let numVal: number;
          if (typeof val === 'number') {
            numVal = val;
          } else {
            let cached = parseCache.get(val);
            if (cached === undefined) {
              if (fieldStats?.type === 'timestamp') {
                cached = Date.parse(val as string);
              } else {
                cached = parseFloat(String(val));
              }
              parseCache.set(val, isNaN(cached) ? 0 : cached);
            }
            numVal = cached;
          }

          if (windowSize === 0) {
            return numVal <= currentTime;
          }
          return numVal >= currentTime - windowSize && numVal <= currentTime;
        });
      }

      // Create a shallow copy with filtered records
      const filteredDataset = {
        ...dataset,
        records: filteredRecords,
      };

      const instantiated = def.buildDeckLayer(layer.id, filteredDataset, layer.config) as Layer | null;
      if (instantiated) {
        deckLayers.push(instantiated);
      }
    } catch (err) {
      console.error(`Failed to compile deck.gl layer ${layer.id}:`, err);
    }
  }

  return deckLayers;
}
export default useDeckLayers;


