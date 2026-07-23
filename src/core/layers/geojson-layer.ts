import { GeoJsonLayer } from 'deck.gl';
import { type LayerDefinition, type LayerConfig, getBlendParameters } from './base-layer';
import { type ProcessedDataset } from '@/types/dataset';
import { getColorScale, getOrdinalScale } from '../colors/scales';
import { getPalette } from '../colors/palettes';
import type { Feature } from 'geojson';

const GEOM_REGEX = /(geojson|geom|_geometry)/i;

export const geojsonDefinition: LayerDefinition = {
  type: 'geojson',
  label: 'GeoJSON Polygon',
  icon: 'Layers',
  requiredGeometry: 'polygon',
  defaultConfig: {
    opacity: 0.6,
    visible: true,
    blendMode: 'additive',
    
    colorMode: 'fixed',
    fillColor: [110, 95, 185], // Muted Violet
    strokeColor: [255, 255, 255],
    strokeWidth: 2,
    colorScale: 'linear',
    colorPalette: 'curated',

    radiusMode: 'fixed',
    radius: 10,
    radiusRange: [2, 30],

    hexagonRadius: 1000,
    elevationScale: 50,
    extruded: false,
    arcWidth: 2,
    radiusPixels: 20,
    intensity: 1,
  },
  validateDataset: (dataset: ProcessedDataset) => {
    if (dataset.format === 'geojson') {
      return dataset.records.some((r) => {
        const geom = r.geometry as { type: string } | undefined;
        return (
          geom?.type === 'Polygon' ||
          geom?.type === 'MultiPolygon' ||
          geom?.type === 'LineString' ||
          geom?.type === 'MultiLineString'
        );
      });
    }
    
    const headers = dataset.fields.map((f) => f.name);
    return headers.some((h) => GEOM_REGEX.test(h));
  },
  buildDeckLayer: (id: string, dataset: ProcessedDataset, config: LayerConfig) => {
    const data = dataset.records;
    const headers = dataset.fields.map((f) => f.name);

    const features: Feature[] = [];
    if (dataset.format === 'geojson') {
      for (const r of data) {
        if (r.geometry && typeof r.geometry === 'object') {
          features.push({
            type: 'Feature',
            geometry: r.geometry as any,
            properties: r as any,
          });
        }
      }
    } else {
      const geojsonField = headers.find((h) => GEOM_REGEX.test(h));
      if (geojsonField) {
        for (const r of data) {
          const rawStr = r[geojsonField];
          if (typeof rawStr === 'string' && rawStr.trim() !== '') {
            try {
              const parsed = JSON.parse(rawStr);
              if (parsed && typeof parsed === 'object') {
                if (parsed.type === 'Feature') {
                  features.push({
                    ...parsed,
                    properties: { ...parsed.properties, ...r },
                  });
                } else if (parsed.type) {
                  features.push({
                    type: 'Feature',
                    geometry: parsed,
                    properties: r as any,
                  });
                }
              }
            } catch {
              // ignore invalid JSON
            }
          } else if (rawStr && typeof rawStr === 'object') {
            features.push({
              type: 'Feature',
              geometry: rawStr as any,
              properties: r as any,
            });
          }
        }
      }
    }

    if (features.length === 0) return null;

    // COLOR ACCESSOR MAPPING
    let getFillColor = (f: unknown): [number, number, number] => {
      const featureObj = f as Feature;
      const propColor = featureObj.properties?.color;
      if (typeof propColor === 'string' && propColor.startsWith('#')) {
        const r = parseInt(propColor.slice(1, 3), 16);
        const g = parseInt(propColor.slice(3, 5), 16);
        const b = parseInt(propColor.slice(5, 7), 16);
        return [isNaN(r) ? 139 : r, isNaN(g) ? 92 : g, isNaN(b) ? 246 : b];
      }
      return config.fillColor || [139, 92, 246];
    };
    
    if (config.colorMode === 'mapped' && config.colorField) {
      const stats = dataset.fields.find((f) => f.name === config.colorField);
      if (stats) {
        const palette = getPalette(config.colorPalette).colors;
        
        if (stats.type === 'string' || stats.type === 'boolean') {
          const ordinalScale = getOrdinalScale(stats.uniqueValues, palette);
          getFillColor = (f: unknown) => {
            const featureObj = f as Feature;
            const val = featureObj.properties?.[config.colorField!] as string | number | boolean | null;
            return ordinalScale(val);
          };
        } else if (typeof stats.min === 'number' && typeof stats.max === 'number') {
          const allVals = data.map((r) => Number(r[config.colorField!])).filter((v) => !isNaN(v));
          const colorScale = getColorScale(
            [stats.min, stats.max],
            palette,
            config.colorScale,
            allVals
          );
          getFillColor = (f: unknown) => {
            const featureObj = f as Feature;
            const val = Number(featureObj.properties?.[config.colorField!]);
            return isNaN(val) ? config.fillColor || [139, 92, 246] : colorScale(val);
          };
        }
      }
    }

    // HEIGHT ACCESSOR MAPPING
    let getElevation = (f: unknown): number => {
      const featureObj = f as Feature;
      if (!featureObj || !featureObj.properties) return 15;

      if (config.geojsonElevationField && featureObj.properties[config.geojsonElevationField] !== undefined) {
        const val = Number(featureObj.properties[config.geojsonElevationField]);
        if (!isNaN(val)) return val;
      }
      if (featureObj.properties.height !== undefined) {
        const val = Number(featureObj.properties.height);
        if (!isNaN(val)) return val;
      }
      if (featureObj.properties.levels !== undefined) {
        const levels = Number(featureObj.properties.levels);
        if (!isNaN(levels)) return levels * 3.5;
      }
      return 15;
    };

    const isSatellite = id.includes('satellite-layer');

    return new GeoJsonLayer({
      id,
      data: features,
      opacity: config.opacity,
      visible: config.visible,
      pickable: true,
      autoHighlight: true,
      extruded: config.extruded,
      filled: true,
      stroked: !isSatellite,
      getFillColor,
      getLineColor: isSatellite ? [0, 0, 0, 0] : (config.colorMode === 'mapped' ? getFillColor : (config.strokeColor || [255, 255, 255])),
      getLineWidth: isSatellite ? 0 : (config.strokeWidth || 2),
      lineWidthMinPixels: isSatellite ? 0 : (config.strokeWidth || 1),
      getElevation,
      elevationScale: config.elevationScale || 1,
      ...getBlendParameters(config.blendMode),
      
      updateTriggers: {
        getFillColor: [config.colorMode, config.fillColor, config.colorField, config.colorPalette, config.colorScale],
        getLineColor: [config.colorMode, config.strokeColor, config.colorField, config.colorPalette, config.colorScale],
        getLineWidth: [config.strokeWidth],
        getElevation: [config.geojsonElevationField],
        elevationScale: [config.elevationScale],
        extruded: [config.extruded],
      },
    });
  },
};
export default geojsonDefinition;
