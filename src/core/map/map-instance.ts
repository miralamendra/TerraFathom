import type maplibregl from 'maplibre-gl';

let activeMapInstance: maplibregl.Map | null = null;

export function setMapInstance(map: maplibregl.Map | null) {
  activeMapInstance = map;
}

export function getMapInstance(): maplibregl.Map | null {
  return activeMapInstance;
}
