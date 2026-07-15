import { ArcLayer } from 'deck.gl';
import { type LayerDefinition, type LayerConfig, getBlendParameters } from './base-layer';
import { type ProcessedDataset, type DatasetRecord } from '@/types/dataset';

const SRC_LAT_REGEX = /^(source|pickup|start|from)_?lat(itude)?$/i;
const SRC_LNG_REGEX = /^(source|pickup|start|from)_?(lng|lon|longitude)$/i;
const DST_LAT_REGEX = /^(target|dropoff|destination|end|to)_?lat(itude)?$/i;
const DST_LNG_REGEX = /^(target|dropoff|destination|end|to)_?(lng|lon|longitude)$/i;

export const arcDefinition: LayerDefinition = {
  type: 'arc',
  label: 'Arc Link',
  icon: 'GitCommit',
  requiredGeometry: 'arc',
  defaultConfig: {
    opacity: 0.8,
    visible: true,
    blendMode: 'additive',
    colorMode: 'fixed',
    radiusMode: 'fixed',
    radiusRange: [3, 30],
    radius: 10,
    strokeWidth: 2,
    arcWidth: 2,
    sourceColor: [244, 63, 94], // Rose-500
    targetColor: [16, 185, 129], // Emerald-500
    fillColor: [244, 63, 94],
    strokeColor: [16, 185, 129],
    hexagonRadius: 1000,
    elevationScale: 50,
    extruded: false,
    radiusPixels: 20,
    intensity: 1,
  },
  validateDataset: (dataset: ProcessedDataset) => {
    if (dataset.format !== 'csv') return false;
    
    // Check if we can find both source and target lat/lng fields
    const headers = dataset.fields.map((f) => f.name);
    const hasSourceLat = headers.some((h) => SRC_LAT_REGEX.test(h));
    const hasSourceLng = headers.some((h) => SRC_LNG_REGEX.test(h));
    const hasDstLat = headers.some((h) => DST_LAT_REGEX.test(h));
    const hasDstLng = headers.some((h) => DST_LNG_REGEX.test(h));

    return hasSourceLat && hasSourceLng && hasDstLat && hasDstLng;
  },
  buildDeckLayer: (id: string, dataset: ProcessedDataset, config: LayerConfig) => {
    const data = dataset.records;
    const headers = dataset.fields.map((f) => f.name);

    const sourceLatField = config.sourceLatField || headers.find((h) => SRC_LAT_REGEX.test(h)) || '';
    const sourceLngField = config.sourceLngField || headers.find((h) => SRC_LNG_REGEX.test(h)) || '';
    const targetLatField = config.targetLatField || headers.find((h) => DST_LAT_REGEX.test(h)) || '';
    const targetLngField = config.targetLngField || headers.find((h) => DST_LNG_REGEX.test(h)) || '';

    if (!sourceLatField || !sourceLngField || !targetLatField || !targetLngField) {
      return null;
    }

    return new ArcLayer({
      id,
      data,
      getSourcePosition: (d: DatasetRecord) => [Number(d[sourceLngField]), Number(d[sourceLatField])],
      getTargetPosition: (d: DatasetRecord) => [Number(d[targetLngField]), Number(d[targetLatField])],
      getSourceColor: config.sourceColor || [244, 63, 94],
      getTargetColor: config.targetColor || [16, 185, 129],
      getWidth: config.arcWidth,
      opacity: config.opacity,
      visible: config.visible,
      pickable: true,
      parameters: getBlendParameters(config.blendMode),
      updateTriggers: {
        getSourceColor: [config.sourceColor],
        getTargetColor: [config.targetColor],
        getWidth: [config.arcWidth],
      },
    });
  },
};
export default arcDefinition;
