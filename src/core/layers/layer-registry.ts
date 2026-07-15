import { type LayerType, type LayerDefinition } from './base-layer';
import { type ProcessedDataset } from '@/types/dataset';
import { scatterplotDefinition } from './scatterplot';
import { hexagonDefinition } from './hexagon';
import { arcDefinition } from './arc';
import { heatmapDefinition } from './heatmap';
import { geojsonDefinition } from './geojson-layer';

export const LAYER_DEFINITIONS: Record<LayerType, LayerDefinition> = {
  scatterplot: scatterplotDefinition,
  hexagon: hexagonDefinition,
  arc: arcDefinition,
  heatmap: heatmapDefinition,
  geojson: geojsonDefinition,
};

export function getLayerDefinition(type: LayerType): LayerDefinition {
  return LAYER_DEFINITIONS[type];
}

export function getCompatibleLayers(dataset: ProcessedDataset): LayerDefinition[] {
  return Object.values(LAYER_DEFINITIONS).filter((def) => def.validateDataset(dataset));
}
