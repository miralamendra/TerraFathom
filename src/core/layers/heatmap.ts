import { HeatmapLayer } from 'deck.gl';
import { type LayerDefinition, type LayerConfig, getBlendParameters } from './base-layer';
import { type ProcessedDataset, type DatasetRecord } from '@/types/dataset';
import { getPalette } from '../colors/palettes';

interface GeometryObj {
  type: string;
  coordinates?: unknown;
}

export const heatmapDefinition: LayerDefinition = {
  type: 'heatmap',
  label: 'Heatmap',
  icon: 'Flame',
  requiredGeometry: 'point',
  defaultConfig: {
    opacity: 0.8,
    visible: true,
    blendMode: 'additive',
    colorMode: 'fixed',
    radiusMode: 'fixed',
    radiusRange: [3, 30],
    radius: 10,
    strokeWidth: 0,
    hexagonRadius: 1000,
    elevationScale: 50,
    extruded: false,
    arcWidth: 2,
    radiusPixels: 30, // blur radius in pixels
    intensity: 1, // weight multiplier
    colorPalette: 'curated',
  },
  validateDataset: (dataset: ProcessedDataset) => {
    if (dataset.format === 'csv') {
      return !!dataset.latField && !!dataset.lngField;
    }
    return dataset.records.some((r) => {
      const geom = r.geometry as GeometryObj | undefined;
      return geom?.type === 'Point' || geom?.type === 'MultiPoint';
    });
  },
  buildDeckLayer: (id: string, dataset: ProcessedDataset, config: LayerConfig) => {
    const data = dataset.records;
    const colorRange = getPalette(config.colorPalette).colors;

    // Check if colorField is defined to weight points
    let getWeight = (_d: DatasetRecord): number => 1;
    if (config.colorField) {
      const stats = dataset.fields.find((f) => f.name === config.colorField);
      if (stats && typeof stats.min === 'number' && typeof stats.max === 'number') {
        getWeight = (d: DatasetRecord) => {
          const val = Number(d[config.colorField!]);
          return isNaN(val) ? 1 : val;
        };
      }
    }

    if (dataset.format === 'csv' && dataset.latField && dataset.lngField) {
      const latF = dataset.latField;
      const lngF = dataset.lngField;
      return new HeatmapLayer({
        id,
        data,
        getPosition: (d: DatasetRecord) => [Number(d[lngF]), Number(d[latF])],
        getWeight,
        radiusPixels: config.radiusPixels,
        intensity: config.intensity,
        colorRange,
        opacity: config.opacity,
        visible: config.visible,
        pickable: false,
        parameters: getBlendParameters(config.blendMode),
        updateTriggers: {
          radiusPixels: [config.radiusPixels],
          intensity: [config.intensity],
          colorRange: [config.colorPalette],
          getWeight: [config.colorField, data],
          getPosition: [data],
        },
      });
    }

    // GeoJSON fallback
    const filteredPoints = data.filter((d) => {
      const geom = d.geometry as GeometryObj | undefined;
      return geom?.type === 'Point' || geom?.type === 'MultiPoint';
    });

    return new HeatmapLayer({
      id,
      data: filteredPoints,
      getPosition: (d: DatasetRecord) => {
        const geom = d.geometry as { coordinates: [number, number] };
        return geom.coordinates;
      },
      getWeight,
      radiusPixels: config.radiusPixels,
      intensity: config.intensity,
      colorRange,
      opacity: config.opacity,
      visible: config.visible,
      pickable: false,
      parameters: getBlendParameters(config.blendMode),
      updateTriggers: {
        radiusPixels: [config.radiusPixels],
        intensity: [config.intensity],
        colorRange: [config.colorPalette],
        getWeight: [config.colorField, filteredPoints],
        getPosition: [filteredPoints],
      },
    });
  },
};
export default heatmapDefinition;
