import { processDataset } from '../processors/data-processor';
import type { ProcessedDataset } from '@/types/dataset';

interface OSMWay {
  id: number;
  type: 'way';
  tags?: {
    name?: string;
    building?: string;
    height?: string;
    'building:levels'?: string;
    [key: string]: any;
  };
  geometry?: { lat: number; lon: number }[];
}

interface OverpassResponse {
  elements: OSMWay[];
}

/**
 * Queries OSM Overpass API for buildings inside [south, west, north, east] bounds
 * and parses them into a standard GeoJSON FeatureCollection Dataset.
 */
export async function fetchAndParseOSMBuildings(
  bounds: [number, number, number, number]
): Promise<ProcessedDataset> {
  const [south, west, north, east] = bounds;

  // 1. Construct Overpass Query
  const query = `[out:json][timeout:15];way["building"](${south},${west},${north},${east});out geom;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OSM Overpass API returned status ${response.status}`);
  }

  const data = (await response.json()) as OverpassResponse;
  const elements = data.elements || [];

  if (elements.length === 0) {
    throw new Error('No 3D building geometries found in this sector.');
  }

  // 2. Parse ways to GeoJSON Features
  const features = elements
    .filter((el) => el.type === 'way' && el.geometry && el.geometry.length > 2)
    .map((way, idx) => {
      // OpenStreetMap polygons must have closed loops (first and last coordinate are identical)
      const coords = way.geometry!.map((pt) => [pt.lon, pt.lat]);
      if (
        coords[0][0] !== coords[coords.length - 1][0] ||
        coords[0][1] !== coords[coords.length - 1][1]
      ) {
        coords.push([coords[0][0], coords[0][1]]);
      }

      // Height calculation
      let height = 15; // default 15m (~5 stories)
      if (way.tags?.height) {
        const parsedHeight = parseFloat(way.tags.height);
        if (!isNaN(parsedHeight)) height = parsedHeight;
      } else if (way.tags?.['building:levels']) {
        const levels = parseInt(way.tags['building:levels'], 10);
        if (!isNaN(levels)) height = levels * 3; // ~3 meters per level
      }

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [coords]
        },
        properties: {
          __id: idx,
          name: way.tags?.name || `OSM Building ${way.id}`,
          height,
          type: way.tags?.building || 'yes',
          levels: parseInt(way.tags?.['building:levels'] || '5', 10)
        }
      };
    });

  if (features.length === 0) {
    throw new Error('Failed to parse building geometries in the selected bounds.');
  }

  const geojson = {
    type: 'FeatureCollection' as const,
    features
  };

  const rawContent = JSON.stringify(geojson);
  const datasetName = `OSM 3D Buildings (${features.length} structural polygons)`;

  const processed = processDataset(
    datasetName,
    rawContent,
    'geojson',
    '#C8A46A' // Warm Brass theme accent
  );

  // Set a distinct custom ID
  processed.id = `osm-buildings-${Date.now()}`;
  return processed;
}
