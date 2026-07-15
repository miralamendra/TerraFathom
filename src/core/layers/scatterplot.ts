import { ScatterplotLayer } from 'deck.gl';
import { type LayerDefinition, type LayerConfig, getBlendParameters } from './base-layer';
import { type ProcessedDataset, type DatasetRecord } from '@/types/dataset';
import { getColorScale, getLinearScale, getOrdinalScale } from '../colors/scales';
import { getPalette } from '../colors/palettes';

interface GeometryObj {
  type: string;
  coordinates?: unknown;
}

export const scatterplotDefinition: LayerDefinition = {
  type: 'scatterplot',
  label: 'Scatterplot',
  icon: 'CircleDot',
  requiredGeometry: 'point',
  defaultConfig: {
    opacity: 0.8,
    visible: true,
    blendMode: 'additive',
    
    colorMode: 'fixed',
    fillColor: [79, 124, 255], // Accent Blue (#4F7CFF)
    strokeColor: [255, 255, 255],
    strokeWidth: 0,
    colorScale: 'linear',
    colorPalette: 'curated',

    radiusMode: 'fixed',
    radius: 12,
    radiusRange: [3, 30],

    hexagonRadius: 1000,
    elevationScale: 50,
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

    // COLOR ACCESSOR MAPPING
    let getFillColor = (_d: DatasetRecord): [number, number, number] => config.fillColor || [79, 124, 255];
    
    if (config.colorMode === 'mapped' && config.colorField) {
      const stats = dataset.fields.find((f) => f.name === config.colorField);
      if (stats) {
        const palette = getPalette(config.colorPalette).colors;
        
        if (stats.type === 'string' || stats.type === 'boolean') {
          // Categorical mapping
          const ordinalScale = getOrdinalScale(stats.uniqueValues, palette);
          getFillColor = (d: DatasetRecord) => {
            const val = d[config.colorField!] as string | number | boolean | null;
            return ordinalScale(val);
          };
        } else if (typeof stats.min === 'number' && typeof stats.max === 'number') {
          // Numerical mapping
          const allVals = data.map((r) => Number(r[config.colorField!])).filter((v) => !isNaN(v));
          const colorScale = getColorScale(
            [stats.min, stats.max],
            palette,
            config.colorScale,
            allVals
          );
          getFillColor = (d: DatasetRecord) => {
            const val = Number(d[config.colorField!]);
            return isNaN(val) ? config.fillColor || [79, 124, 255] : colorScale(val);
          };
        }
      }
    }

    // SIZE/RADIUS ACCESSOR MAPPING
    let getRadius = (_d: DatasetRecord): number => config.radius;
    
    if (config.radiusMode === 'mapped' && config.radiusField) {
      const stats = dataset.fields.find((f) => f.name === config.radiusField);
      if (stats && typeof stats.min === 'number' && typeof stats.max === 'number') {
        const radiusScale = getLinearScale([stats.min, stats.max], config.radiusRange || [3, 30]);
        getRadius = (d: DatasetRecord) => {
          const val = Number(d[config.radiusField!]);
          return isNaN(val) ? config.radiusRange[0] : radiusScale(val);
        };
      }
    }

    if (dataset.format === 'csv' && dataset.latField && dataset.lngField) {
      const latF = dataset.latField;
      const lngF = dataset.lngField;
      return new ScatterplotLayer({
        id,
        data,
        getPosition: (d: DatasetRecord) => [Number(d[lngF]), Number(d[latF])],
        getRadius,
        getFillColor,
        getLineColor: config.strokeColor || [255, 255, 255],
        getLineWidth: config.strokeWidth,
        radiusScale: 1,
        radiusMinPixels: 1,
        radiusMaxPixels: 100,
        stroked: config.strokeWidth > 0,
        filled: true,
        opacity: config.opacity,
        visible: config.visible,
        pickable: true,
        parameters: getBlendParameters(config.blendMode),
        updateTriggers: {
          getRadius: [config.radiusMode, config.radius, config.radiusField, config.radiusRange],
          getFillColor: [config.colorMode, config.fillColor, config.colorField, config.colorPalette, config.colorScale],
          getLineWidth: [config.strokeWidth],
        },
      });
    }

    // GeoJSON fallback
    const filteredPoints = data.filter((d) => {
      const geom = d.geometry as GeometryObj | undefined;
      return geom?.type === 'Point' || geom?.type === 'MultiPoint';
    });

    return new ScatterplotLayer({
      id,
      data: filteredPoints,
      getPosition: (d: DatasetRecord) => {
        const geom = d.geometry as { coordinates: [number, number] };
        return geom.coordinates;
      },
      getRadius,
      getFillColor,
      getLineColor: config.strokeColor || [255, 255, 255],
      getLineWidth: config.strokeWidth,
      radiusScale: 1,
      radiusMinPixels: 1,
      radiusMaxPixels: 100,
      stroked: config.strokeWidth > 0,
      filled: true,
      opacity: config.opacity,
      visible: config.visible,
      pickable: true,
      parameters: getBlendParameters(config.blendMode),
      updateTriggers: {
        getRadius: [config.radiusMode, config.radius, config.radiusField, config.radiusRange],
        getFillColor: [config.colorMode, config.fillColor, config.colorField, config.colorPalette, config.colorScale],
        getLineWidth: [config.strokeWidth],
      },
    });
  },
};
export default scatterplotDefinition;
