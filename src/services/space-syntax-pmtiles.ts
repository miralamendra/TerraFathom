import maplibregl from 'maplibre-gl';
import * as pmtiles from 'pmtiles';
import type { LayerConfig } from '@/core/layers/base-layer';

export type SpaceSyntaxMetric = string;

let pmtilesRegistered = false;

export function registerPMTilesProtocol() {
  if (!pmtilesRegistered) {
    try {
      const protocol = new pmtiles.Protocol();
      maplibregl.addProtocol('pmtiles', protocol.tile);
      pmtilesRegistered = true;
    } catch {
      // Protocol already registered
    }
  }
}

export function buildColorRampExpression(
  colorField: string = 'choice',
  palette: string = 'space-syntax',
  colorScale: string = 'quantile'
) {
  const fieldKey = colorField || 'choice';

  // Hyper-Rich, Highly Saturated Neon/Vivid Color Palettes
  let colors = ['#0022ff', '#00ccff', '#00ff66', '#ffea00', '#ff6600', '#ff0033'];

  if (palette === 'viridis') {
    colors = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'];
  } else if (palette === 'magma') {
    colors = ['#000004', '#51127c', '#b73779', '#e16462', '#fcfdbf'];
  } else if (palette === 'plasma') {
    colors = ['#0d0887', '#6a00a8', '#b12a90', '#e16462', '#fca636', '#f0f921'];
  } else if (palette === 'warm-brass' || palette === 'gold') {
    colors = ['#1c1000', '#663300', '#cc7700', '#ffaa00', '#ffee66'];
  } else if (palette === 'cool-blue' || palette === 'blues') {
    colors = ['#001144', '#0044cc', '#0088ff', '#00d4ff', '#ccf5ff'];
  } else if (palette === 'redBlue' || palette === 'red-blue') {
    colors = ['#0033ff', '#00ccff', '#ffaa00', '#ff0033'];
  } else if (palette === 'purples') {
    colors = ['#2a004f', '#6a00b8', '#a100ff', '#d488ff', '#f2e0ff'];
  } else if (palette === 'greens') {
    colors = ['#003815', '#008537', '#00d659', '#66ff99', '#e0ffed'];
  }

  // Dynamic field key getter with property fallbacks
  const getFieldExpr = [
    'coalesce',
    ['get', fieldKey],
    ['get', fieldKey.toLowerCase()],
    ['get', fieldKey.toUpperCase()],
    ['get', 'BtA500'],
    ['get', 'BtA10000'],
    ['get', 'BtA10k'],
    ['get', 'choice_500m'],
    ['get', 'choice_10k'],
    ['get', 'choice'],
    0
  ];

  // Quantize / Step Bucket Mode
  if (colorScale === 'quantize') {
    if (fieldKey.includes('NQPDA') || fieldKey.includes('integration')) {
      return [
        'step',
        getFieldExpr,
        colors[0],
        0.5, colors[1],
        1.2, colors[2],
        1.8, colors[3],
        2.5, colors[4],
        3.2, colors[colors.length - 1]
      ];
    }
    return [
      'step',
      getFieldExpr,
      colors[0],
      100, colors[1],
      500, colors[2],
      1500, colors[3],
      4000, colors[4],
      10000, colors[colors.length - 1]
    ];
  }

  // Linear Scale Mode
  if (colorScale === 'linear') {
    if (fieldKey.includes('NQPDA') || fieldKey.includes('integration')) {
      return [
        'interpolate',
        ['linear'],
        getFieldExpr,
        0.1, colors[0],
        0.7, colors[1],
        1.3, colors[2],
        1.9, colors[3],
        2.5, colors[4],
        3.4, colors[colors.length - 1]
      ];
    }
    return [
      'interpolate',
      ['linear'],
      getFieldExpr,
      0, colors[0],
      500, colors[1],
      2000, colors[2],
      5000, colors[3],
      10000, colors[4],
      18000, colors[colors.length - 1]
    ];
  }

  // Superior Scientific Quantile & Logarithmic Scale Mode for Space Syntax Skewed Power-Law Distributions
  if (fieldKey.includes('NQPDA') || fieldKey.includes('integration') || fieldKey.includes('LAC') || fieldKey.includes('LSin')) {
    return [
      'interpolate',
      ['linear'],
      getFieldExpr,
      0.1, colors[0],
      0.6, colors[1],
      1.2, colors[2],
      1.8, colors[3],
      2.4, colors[4],
      3.4, colors[colors.length - 1]
    ];
  } else if (fieldKey.includes('LLen') || fieldKey.includes('Len') || fieldKey.includes('length') || fieldKey.includes('MAD')) {
    return [
      'interpolate',
      ['linear'],
      getFieldExpr,
      10, colors[0],
      80, colors[1],
      300, colors[2],
      800, colors[3],
      2000, colors[4],
      5000, colors[colors.length - 1]
    ];
  } else if (fieldKey.includes('Conn') || fieldKey.includes('connectivity') || fieldKey.includes('Lnk')) {
    return [
      'interpolate',
      ['linear'],
      getFieldExpr,
      1, colors[0],
      3, colors[1],
      5, colors[2],
      8, colors[3],
      10, colors[4],
      14, colors[colors.length - 1]
    ];
  }

  // Choice / Betweenness Power-Law Quantile Breaks (Academic Standard)
  return [
    'interpolate',
    ['linear'],
    getFieldExpr,
    0, colors[0],
    30, colors[1],
    150, colors[2],
    600, colors[3],
    2000, colors[4],
    8000, colors[colors.length - 1]
  ];
}

const datasetBlobCache: Record<string, string> = {};

export function prefetchSpaceSyntaxDatasets(): void {
  if (typeof window === 'undefined') return;
  const base = import.meta.env.BASE_URL || '/';
  const origin = window.location.origin;
  const cleanBase = base.endsWith('/') ? base : `${base}/`;

  const files = ['500.geojson.gz', '10km.geojson.gz'];

  files.forEach(async (file) => {
    const url = `${origin}${cleanBase}data/${file}`;
    if (datasetBlobCache[url]) return;

    try {
      const res = await fetch(url);
      if (res.ok && res.body && typeof DecompressionStream !== 'undefined') {
        const ds = new DecompressionStream('gzip');
        const decompressed = res.body.pipeThrough(ds);
        const jsonText = await new Response(decompressed).text();
        const blob = new Blob([jsonText], { type: 'application/json' });
        datasetBlobCache[url] = URL.createObjectURL(blob);
      }
    } catch (e) {
      // Quiet background prefetch
    }
  });
}

export function loadSpaceSyntaxPMTilesLayer(
  map: maplibregl.Map,
  metric: SpaceSyntaxMetric = 'BtA500',
  configOverrides?: Partial<LayerConfig>
): void {
  if (!map) return;

  const sourceId = 'space-syntax-pmtiles-source';
  const layerId = 'space-syntax-pmtiles-layer';

  const applyLayer = () => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }

    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }

    const base = import.meta.env.BASE_URL || '/';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const cleanBase = base.endsWith('/') ? base : `${base}/`;
    
    const fileName = (metric.includes('10000') || metric.includes('10k') || metric.includes('BtA10000'))
      ? '10km.geojson'
      : '500.geojson';

    const gzUrl = `${origin}${cleanBase}data/${fileName}.gz`;
    const rawUrl = `${origin}${cleanBase}data/${fileName}`;

    const colorField = configOverrides?.colorField || metric;
    const colorPalette = configOverrides?.colorPalette || 'space-syntax';
    const colorScale = configOverrides?.colorScale || 'quantile';
    const colorRamp = buildColorRampExpression(colorField, colorPalette, colorScale);
    
    const strokeWidth = configOverrides?.strokeWidth ?? 1.0;
    const opacity = configOverrides?.opacity ?? 1.0;

    const renderGeoJSON = (dataOrUrl: any) => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      map.addSource(sourceId, {
        type: 'geojson',
        data: dataOrUrl,
        tolerance: 0.2,
        buffer: 64,
      });

      const layerSpec: maplibregl.LayerSpecification = {
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-cap': 'butt',
          'line-join': 'miter',
          'line-miter-limit': 3,
          visibility: 'visible',
        },
        paint: {
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            9, Math.max(0.75, strokeWidth * 0.75),
            12, Math.max(1.25, strokeWidth * 1.25),
            15, Math.max(2.5, strokeWidth * 2.5),
            18, Math.max(4.5, strokeWidth * 4.5)
          ],
          'line-color': colorRamp as any,
          'line-opacity': opacity,
          'line-blur': 0,
        },
      };

      map.addLayer(layerSpec);
    };

    const fetchAndDecompressBlob = async (url: string): Promise<string | null> => {
      if (datasetBlobCache[url]) {
        return datasetBlobCache[url];
      }
      try {
        const res = await fetch(url);
        if (res.ok && res.body && typeof DecompressionStream !== 'undefined') {
          const ds = new DecompressionStream('gzip');
          const decompressed = res.body.pipeThrough(ds);
          const jsonText = await new Response(decompressed).text();
          const blob = new Blob([jsonText], { type: 'application/json' });
          const blobUrl = URL.createObjectURL(blob);
          datasetBlobCache[url] = blobUrl;
          return blobUrl;
        }
      } catch (e) {
        console.error('Failed to fetch/decompress dataset:', url, e);
      }
      return null;
    };

    const loadDataset = async () => {
      // 1. Check in-memory prefetch cache
      if (datasetBlobCache[gzUrl]) {
        renderGeoJSON(datasetBlobCache[gzUrl]);
        return;
      }

      // 2. Try fetching & decompressing 9.5MB gzipped file directly
      const blobUrl = await fetchAndDecompressBlob(gzUrl);
      if (blobUrl) {
        renderGeoJSON(blobUrl);
        return;
      }

      // 3. Dev server fallback to raw JSON
      try {
        const res = await fetch(rawUrl, { method: 'HEAD' });
        if (res.ok) {
          renderGeoJSON(rawUrl);
          return;
        }
      } catch (e) {
        // Fallback
      }

      // 4. Sample fallback if all else fails
      renderGeoJSON(`${origin}${cleanBase}data/space-syntax-sample.json`);
    };

    loadDataset();
  };

  if (map.isStyleLoaded()) {
    applyLayer();
  } else {
    map.once('style.load', applyLayer);
  }
}

export function updateSpaceSyntaxStyleFromLayerConfig(
  map: maplibregl.Map,
  config: Partial<LayerConfig>
): void {
  if (!map) return;
  const layerId = 'space-syntax-pmtiles-layer';

  if (!map.getLayer(layerId)) return;

  if (config.visible !== undefined) {
    map.setLayoutProperty(layerId, 'visibility', config.visible ? 'visible' : 'none');
  }

  if (config.opacity !== undefined) {
    map.setPaintProperty(layerId, 'line-opacity', config.opacity);
  }

  if (config.strokeWidth !== undefined) {
    const sw = config.strokeWidth;
    map.setPaintProperty(layerId, 'line-width', [
      'interpolate',
      ['linear'],
      ['zoom'],
      9, Math.max(0.75, sw * 0.75),
      12, Math.max(1.25, sw * 1.25),
      15, Math.max(2.5, sw * 2.5),
      18, Math.max(4.5, sw * 4.5)
    ]);
  }

  if (config.colorMode === 'fixed' && (config.strokeColor || config.fillColor)) {
    const [r, g, b] = config.strokeColor || config.fillColor || [200, 164, 106];
    map.setPaintProperty(layerId, 'line-color', `rgb(${r}, ${g}, ${b})`);
  } else if (config.colorField || config.colorPalette || config.colorScale) {
    const ramp = buildColorRampExpression(
      config.colorField || 'choice',
      config.colorPalette || 'space-syntax',
      config.colorScale || 'quantile'
    );
    map.setPaintProperty(layerId, 'line-color', ramp as any);
  }
}

export function unloadSpaceSyntaxPMTilesLayer(map: maplibregl.Map): void {
  if (!map) return;
  const sourceId = 'space-syntax-pmtiles-source';
  const layerId = 'space-syntax-pmtiles-layer';

  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}
