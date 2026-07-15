import { HexagonLayer } from 'deck.gl';
import { type LayerDefinition, type LayerConfig, getBlendParameters } from './base-layer';
import { type ProcessedDataset, type DatasetRecord } from '@/types/dataset';
import { getPalette } from '../colors/palettes';

interface GeometryObj {
  type: string;
  coordinates?: unknown;
}

export const hexagonDefinition: LayerDefinition = {
  type: 'hexagon',
  label: 'Hexagon (3D)',
  icon: 'Hexagon',
  requiredGeometry: 'point',
  defaultConfig: {
    opacity: 0.7,
    visible: true,
    blendMode: 'additive',
    
    colorMode: 'fixed', // mapped means weighted aggregation
    colorField: '',
    colorPalette: 'curated',
    
    radiusMode: 'fixed',
    radius: 12,
    radiusRange: [2, 50],
    strokeWidth: 0,
    
    hexagonRadius: 200,
    elevationScale: 20,
    extruded: false,
    arcWidth: 2,
    radiusPixels: 20,
    intensity: 1,
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

    // Weight helper
    const hasColorMapping = config.colorMode === 'mapped' && config.colorField;
    const getColorWeight = hasColorMapping
      ? (d: DatasetRecord) => {
          const val = Number(d[config.colorField!]);
          return isNaN(val) ? 0 : val;
        }
      : undefined;

    // Deck.gl Hexagon options
    const options: any = {
      id,
      radius: config.hexagonRadius,
      elevationScale: config.elevationScale,
      extruded: config.extruded,
      colorRange,
      opacity: config.opacity,
      visible: config.visible,
      pickable: true,
      parameters: getBlendParameters(config.blendMode),
    };

    if (getColorWeight) {
      options.getColorWeight = getColorWeight;
      options.colorAggregation = 'MEAN';
    }

    if (dataset.format === 'csv' && dataset.latField && dataset.lngField) {
      const latF = dataset.latField;
      const lngF = dataset.lngField;
      return new HexagonLayer({
        ...options,
        data,
        getPosition: (d: DatasetRecord) => [Number(d[lngF]), Number(d[latF])],
        updateTriggers: {
          radius: [config.hexagonRadius],
          elevationScale: [config.elevationScale],
          extruded: [config.extruded],
          colorRange: [config.colorPalette],
          getColorWeight: [config.colorField, config.colorMode, data],
          getPosition: [data],
        },
      });
    }

    // GeoJSON fallback
    const filteredPoints = data.filter((d) => {
      const geom = d.geometry as GeometryObj | undefined;
      return geom?.type === 'Point' || geom?.type === 'MultiPoint';
    });

    return new HexagonLayer({
      ...options,
      data: filteredPoints,
      getPosition: (d: DatasetRecord) => {
        const geom = d.geometry as { coordinates: [number, number] };
        return geom.coordinates;
      },
      updateTriggers: {
        radius: [config.hexagonRadius],
        elevationScale: [config.elevationScale],
        extruded: [config.extruded],
        colorRange: [config.colorPalette],
        getColorWeight: [config.colorField, config.colorMode, filteredPoints],
        getPosition: [filteredPoints],
      },
    });
  },
};
export default hexagonDefinition;
