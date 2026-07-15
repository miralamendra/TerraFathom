import { type ProcessedDataset } from '@/types/dataset';

export type LayerType = 'scatterplot' | 'hexagon' | 'arc' | 'heatmap' | 'geojson';

export interface LayerConfig {
  opacity: number;
  visible: boolean;
  blendMode?: 'normal' | 'additive' | 'subtract';
  
  // Color Mapping
  colorMode: 'fixed' | 'mapped';
  colorField?: string;
  colorScale?: 'quantize' | 'linear' | 'quantile' | 'logarithmic' | 'ordinal';
  colorPalette?: string; // name of palette option
  fillColor?: [number, number, number]; // [R, G, B]
  strokeColor?: [number, number, number]; // [R, G, B]
  
  // Size Mapping
  radiusMode: 'fixed' | 'mapped';
  radius: number; // size multiplier
  radiusField?: string;
  radiusRange: [number, number]; // [min, max] size bounds
  strokeWidth: number;
  
  // Hexagon
  hexagonRadius: number; // grid meters
  elevationScale: number; // extrusion heights
  extruded: boolean; // 3D Extrude
  
  // Arc
  arcWidth: number;
  sourceLatField?: string;
  sourceLngField?: string;
  targetLatField?: string;
  targetLngField?: string;
  sourceColor?: [number, number, number];
  targetColor?: [number, number, number];
  
  // Heatmap
  radiusPixels: number; // blur radius
  intensity: number;
  
  // GeoJSON
  geojsonElevationField?: string;
}

export interface LayerInstance {
  id: string;
  name: string;
  type: LayerType;
  datasetId: string;
  config: LayerConfig;
}

export interface LayerDefinition {
  type: LayerType;
  label: string;
  icon: string;
  requiredGeometry: 'point' | 'polygon' | 'arc';
  defaultConfig: LayerConfig;
  validateDataset: (dataset: ProcessedDataset) => boolean;
  buildDeckLayer: (id: string, dataset: ProcessedDataset, config: LayerConfig) => unknown;
}

export function getBlendParameters(blendMode: 'normal' | 'additive' | 'subtract' = 'additive') {
  // WebGL 1 & 2 blending constants
  const GL_SRC_ALPHA = 0x0302;
  const GL_ONE_MINUS_SRC_ALPHA = 0x0303;
  const GL_ONE = 1;
  const GL_FUNC_ADD = 0x8006;
  const GL_FUNC_REVERSE_SUBTRACT = 0x800B;

  if (blendMode === 'normal') {
    return {
      blend: true,
      blendFunc: [GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_ONE, GL_ONE_MINUS_SRC_ALPHA],
      blendEquation: GL_FUNC_ADD,
    };
  } else if (blendMode === 'subtract') {
    return {
      blend: true,
      blendFunc: [GL_SRC_ALPHA, GL_ONE, GL_ONE, GL_ONE],
      blendEquation: GL_FUNC_REVERSE_SUBTRACT,
    };
  } else {
    // 'additive' (default)
    return {
      blend: true,
      blendFunc: [GL_SRC_ALPHA, GL_ONE, GL_ONE, GL_ONE],
      blendEquation: GL_FUNC_ADD,
    };
  }
}

