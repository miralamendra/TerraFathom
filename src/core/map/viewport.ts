export interface Viewport {
  latitude: number;
  longitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export function clampLatitude(lat: number): number {
  return Math.max(-85, Math.min(85, lat));
}

export function clampLongitude(lng: number): number {
  let normalized = lng % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized < -180) normalized += 360;
  return normalized;
}

export function clampZoom(zoom: number): number {
  return Math.max(0, Math.min(24, zoom));
}

export function clampPitch(pitch: number): number {
  return Math.max(0, Math.min(60, pitch));
}

export function clampBearing(bearing: number): number {
  let normalized = bearing % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized < -180) normalized += 360;
  return normalized;
}

export function clampViewport(viewport: Viewport): Viewport {
  return {
    latitude: clampLatitude(viewport.latitude),
    longitude: clampLongitude(viewport.longitude),
    zoom: clampZoom(viewport.zoom),
    pitch: clampPitch(viewport.pitch),
    bearing: clampBearing(viewport.bearing),
  };
}
