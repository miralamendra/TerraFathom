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

interface OSMNode {
  id: number;
  type: 'node';
  lat: number;
  lon: number;
  tags?: {
    name?: string;
    amenity?: string;
    [key: string]: any;
  };
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];

/**
 * Execute Overpass query with mirror failover and timeout handling
 */
async function queryOverpassMirror(query: string): Promise<any> {
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000); // 18s per mirror timeout

      const url = `${endpoint}?data=${encodeURIComponent(query)}`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        return await response.json();
      }
      lastError = new Error(`Mirror ${endpoint} returned status ${response.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('All Overpass API mirrors failed to respond.');
}

/**
 * Helper to split large bounding boxes into a 2x2 grid of sub-quadrants
 */
function splitBoundingBox(bounds: [number, number, number, number]): [number, number, number, number][] {
  const [south, west, north, east] = bounds;
  const latSpan = north - south;
  const lngSpan = east - west;

  // If boundary is compact (<= 1.5km), no need to split
  if (latSpan <= 0.018 && lngSpan <= 0.018) {
    return [bounds];
  }

  const midLat = south + latSpan / 2;
  const midLng = west + lngSpan / 2;

  return [
    [south, west, midLat, midLng],
    [south, midLng, midLat, east],
    [midLat, west, north, midLng],
    [midLat, midLng, north, east],
  ];
}

/**
 * Queries OSM Overpass API for 3D buildings inside [south, west, north, east] bounds
 * Supports large selection areas via automatic 2x2 sub-quadrant tiling and mirror failover.
 */
export async function fetchAndParseOSMBuildings(
  bounds: [number, number, number, number]
): Promise<ProcessedDataset> {
  const quadrants = splitBoundingBox(bounds);
  const elementsMap = new Map<number, OSMWay>();

  const results = await Promise.allSettled(
    quadrants.map(async ([s, w, n, e]) => {
      const query = `[out:json][timeout:25];way["building"](${s},${w},${n},${e});out geom;`;
      const data = await queryOverpassMirror(query);
      return data.elements || [];
    })
  );

  for (const res of results) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      for (const el of res.value) {
        if (el.type === 'way' && el.id && !elementsMap.has(el.id)) {
          elementsMap.set(el.id, el);
        }
      }
    }
  }

  const elements = Array.from(elementsMap.values());

  if (elements.length === 0) {
    throw new Error('No 3D building geometries found in this sector. Try selecting another area.');
  }

  // Parse ways to GeoJSON Features
  const features = elements
    .filter((el) => el.geometry && el.geometry.length > 2)
    .map((way, idx) => {
      const coords = way.geometry!.map((pt) => [pt.lon, pt.lat]);
      if (
        coords[0][0] !== coords[coords.length - 1][0] ||
        coords[0][1] !== coords[coords.length - 1][1]
      ) {
        coords.push([coords[0][0], coords[0][1]]);
      }

      let height = 15;
      if (way.tags?.height) {
        const parsedHeight = parseFloat(way.tags.height);
        if (!isNaN(parsedHeight)) height = parsedHeight;
      } else if (way.tags?.['building:levels']) {
        const levels = parseInt(way.tags['building:levels'], 10);
        if (!isNaN(levels)) height = levels * 3;
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
  const datasetName = `OSM 3D Buildings (${features.length} structures)`;

  const processed = processDataset(
    datasetName,
    rawContent,
    'geojson',
    '#C8A46A'
  );

  processed.id = `osm-buildings-${Date.now()}`;
  return processed;
}

/**
 * Queries OSM Overpass API for amenities (hospitals, schools, restaurants, etc.) inside bounds
 */
export async function fetchAndParseOSMAmenities(
  bounds: [number, number, number, number]
): Promise<ProcessedDataset> {
  const quadrants = splitBoundingBox(bounds);
  const elementsMap = new Map<number, OSMNode>();

  const results = await Promise.allSettled(
    quadrants.map(async ([s, w, n, e]) => {
      const query = `[out:json][timeout:25];node["amenity"](${s},${w},${n},${e});out body;`;
      const data = await queryOverpassMirror(query);
      return data.elements || [];
    })
  );

  for (const res of results) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      for (const el of res.value) {
        if (el.type === 'node' && el.id && !elementsMap.has(el.id)) {
          elementsMap.set(el.id, el);
        }
      }
    }
  }

  const elements = Array.from(elementsMap.values());

  if (elements.length === 0) {
    throw new Error('No amenity points found in this sector.');
  }

  const features = elements.map((node, idx) => ({
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [node.lon, node.lat]
    },
    properties: {
      __id: idx,
      name: node.tags?.name || `OSM ${node.tags?.amenity || 'Amenity'} ${node.id}`,
      amenity: node.tags?.amenity || 'amenity',
      type: node.tags?.amenity || 'point'
    }
  }));

  const geojson = {
    type: 'FeatureCollection' as const,
    features
  };

  const rawContent = JSON.stringify(geojson);
  const datasetName = `OSM Amenities (${features.length} points)`;

  const processed = processDataset(
    datasetName,
    rawContent,
    'geojson',
    '#27A644'
  );

  processed.id = `osm-amenities-${Date.now()}`;
  return processed;
}
