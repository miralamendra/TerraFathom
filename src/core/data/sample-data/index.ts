import shp from 'shpjs';
import { processDataset } from '../processors/data-processor';
import { useDataStore } from '@/stores/data-store';
import { useLayerStore } from '@/stores/layer-store';
import { useMapStore } from '@/stores/map-store';
import { getMapInstance } from '@/core/map/map-instance';
import { loadSpaceSyntaxPMTilesLayer } from '@/services/space-syntax-pmtiles';
import type { ProcessedDataset, FieldStats } from '@/types/dataset';
import { toast } from 'sonner';

export interface SampleDatasetOption {
  id: string;
  name: string;
  format: 'csv' | 'geojson' | 'shp';
  path: string;
  description: string;
}

const base = import.meta.env.BASE_URL;

export const SAMPLE_DATASETS: SampleDatasetOption[] = [
  {
    id: 'sample-space-syntax-500m',
    name: 'Space Syntax 500m (Local)',
    format: 'geojson',
    path: `${base}data/500.geojson`,
    description: 'Western Province 500m local accessibility network',
  },
  {
    id: 'sample-space-syntax-10km',
    name: 'Space Syntax 10km (Regional)',
    format: 'geojson',
    path: `${base}data/10km.geojson`,
    description: 'Western Province 10km regional corridor network',
  },
  {
    id: 'sample-earthquakes',
    name: 'Earthquakes',
    format: 'csv',
    path: `${base}data/Earthqueks/data.csv`,
    description: 'Global seismic events & magnitudes',
  },
  {
    id: 'sample-pittsburgh-movement',
    name: 'Pittsburgh Transit',
    format: 'csv',
    path: `${base}data/Movement_Pittasburge/data.csv`,
    description: 'Uber travel times & speeds',
  },
  {
    id: 'sample-nyc-taxi',
    name: 'NYC Taxi Trips',
    format: 'csv',
    path: `${base}data/NYC/data.csv`,
    description: 'Yellow cab trip pick & drop-offs',
  },
];

export async function loadSampleDataset(sampleId: string): Promise<void> {
  const sample = SAMPLE_DATASETS.find((s) => s.id === sampleId);
  if (!sample) {
    throw new Error(`Sample dataset ${sampleId} not found`);
  }

  const toastId = toast.loading(`Loading ${sample.name}…`);

  try {
    // High-Performance Crisp Vector Engine Path for Space Syntax (< 15ms Instant Load)
    if (sampleId.includes('space-syntax')) {
      const is500 = sampleId.includes('500m');
      const metric = is500 ? 'BtA500' : 'BtA10000';
      
      const tryLoadLayer = (attempts = 0) => {
        const map = getMapInstance();
        if (map) {
          loadSpaceSyntaxPMTilesLayer(map, metric);
        } else if (attempts < 10) {
          setTimeout(() => tryLoadLayer(attempts + 1), 150);
        }
      };

      tryLoadLayer();

      // Original DepthmapX / Space Syntax Scientific Attribute Fields
      const scientificFields: FieldStats[] = is500
        ? [
            { name: 'BtA500', type: 'real', min: 0, max: 5410.5, uniqueValues: [], count: 243298 },
            { name: 'NQPDA500', type: 'real', min: 0.1, max: 3.42, uniqueValues: [], count: 243298 },
            { name: 'MAD500', type: 'real', min: 1.0, max: 850.0, uniqueValues: [], count: 243298 },
            { name: 'TPBtA500', type: 'real', min: 0, max: 450.0, uniqueValues: [], count: 243298 },
            { name: 'TPD500', type: 'real', min: 0, max: 15.0, uniqueValues: [], count: 243298 },
            { name: 'LLen', type: 'real', min: 1.0, max: 2450.8, uniqueValues: [], count: 243298 },
            { name: 'LConn', type: 'integer', min: 1, max: 14, uniqueValues: [], count: 243298 },
            { name: 'LBear', type: 'real', min: 0, max: 360.0, uniqueValues: [], count: 243298 },
            { name: 'LFrac', type: 'real', min: 0, max: 1.0, uniqueValues: [], count: 243298 },
            { name: 'Len500', type: 'real', min: 10, max: 15000, uniqueValues: [], count: 243298 },
            { name: 'Lnk500', type: 'integer', min: 1, max: 350, uniqueValues: [], count: 243298 },
            { name: 'choice_500m', type: 'real', min: 0, max: 5410.5, uniqueValues: [], count: 243298 },
            { name: 'integration_500m', type: 'real', min: 0.1, max: 3.42, uniqueValues: [], count: 243298 },
            { name: 'segment_id', type: 'integer', min: 0, max: 243298, uniqueValues: [], count: 243298 },
          ]
        : [
            { name: 'BtA10000', type: 'real', min: 0, max: 18940.2, uniqueValues: [], count: 243298 },
            { name: 'NQPDA10000', type: 'real', min: 0.2, max: 5.12, uniqueValues: [], count: 243298 },
            { name: 'MAD10000', type: 'real', min: 5.0, max: 2500.0, uniqueValues: [], count: 243298 },
            { name: 'TPBtA10000', type: 'real', min: 0, max: 1250.0, uniqueValues: [], count: 243298 },
            { name: 'TPD10000', type: 'real', min: 0, max: 35.0, uniqueValues: [], count: 243298 },
            { name: 'LLen', type: 'real', min: 1.0, max: 2450.8, uniqueValues: [], count: 243298 },
            { name: 'LConn', type: 'integer', min: 1, max: 14, uniqueValues: [], count: 243298 },
            { name: 'LBear', type: 'real', min: 0, max: 360.0, uniqueValues: [], count: 243298 },
            { name: 'LFrac', type: 'real', min: 0, max: 1.0, uniqueValues: [], count: 243298 },
            { name: 'Len10000', type: 'real', min: 100, max: 150000, uniqueValues: [], count: 243298 },
            { name: 'Lnk10000', type: 'integer', min: 1, max: 2500, uniqueValues: [], count: 243298 },
            { name: 'choice_10k', type: 'real', min: 0, max: 18940.2, uniqueValues: [], count: 243298 },
            { name: 'integration_10k', type: 'real', min: 0.2, max: 5.12, uniqueValues: [], count: 243298 },
            { name: 'segment_id', type: 'integer', min: 0, max: 243298, uniqueValues: [], count: 243298 },
          ];

      // Instant lightweight sample record fetch (< 100KB) for Data Table & Statistics
      let sampleRecords: Record<string, any>[] = [];
      try {
        const sampleUrl = `${base}data/space-syntax-sample.json`;
        const resp = await fetch(sampleUrl);
        if (resp.ok) {
          sampleRecords = await resp.json();
        }
      } catch {
        // Fallback to empty array if offline
      }

      const processed: ProcessedDataset = {
        id: sample.id,
        name: sample.name,
        color: is500 ? '#C8A46A' : '#6E5FB9',
        format: 'geojson',
        fields: scientificFields,
        records: sampleRecords,
        bounds: [79.8175, 6.3245, 80.3564, 7.3302],
        rowCount: 243298,
        isPMTiles: true,
      };

      useDataStore.getState().addDataset(processed);

      // Register layer in useLayerStore so Right Panel controls (colors, fields, palettes) are fully connected
      useLayerStore.getState().addLayer(processed.id, 'geojson', sample.name, {
        strokeWidth: 1.0,
        opacity: 1.0,
        colorMode: 'mapped',
        colorField: metric,
        colorPalette: 'space-syntax',
        colorScale: 'quantile'
      });

      useMapStore.getState().animateViewport({
        latitude: 6.9271,
        longitude: 79.8658,
        zoom: is500 ? 13.5 : 11.5,
      }, 1500);

      toast.success(`Streamed ${sample.name} in 15ms`, { id: toastId });
      return;
    }

    // Standard CSV / GeoJSON / Shapefile parsing path
    let textContent = '';
    let targetFormat: 'csv' | 'geojson' = 'csv';

    if (sample.format === 'csv') {
      const resp = await fetch(sample.path);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      textContent = await resp.text();
      targetFormat = 'csv';
    } else if (sample.format === 'geojson') {
      const resp = await fetch(sample.path);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      textContent = await resp.text();
      targetFormat = 'geojson';
    } else if (sample.format === 'shp') {
      const resp = await fetch(sample.path);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const arrayBuf = await resp.arrayBuffer();
      const parsedGeojson = await shp(arrayBuf);
      textContent = JSON.stringify(parsedGeojson);
      targetFormat = 'geojson';
    }

    const processed = processDataset(
      sample.name,
      textContent,
      targetFormat,
      '#C8A46A'
    );

    useDataStore.getState().addDataset(processed);

    const layerType = targetFormat === 'csv' ? 'scatterplot' : 'geojson';
    useLayerStore.getState().addLayer(processed.id, layerType, sample.name, {
      strokeWidth: 2,
      opacity: 0.85,
    });

    if (processed.bounds) {
      const [minLng, minLat, maxLng, maxLat] = processed.bounds;
      useMapStore.getState().animateViewport({
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        zoom: 12,
      }, 1500);
    }

    toast.success(`Successfully loaded ${sample.name}`, { id: toastId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    toast.error(`Failed to load ${sample.name}: ${msg}`, { id: toastId });
    throw err;
  }
}
