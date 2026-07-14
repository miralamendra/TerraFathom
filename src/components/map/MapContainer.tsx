import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { DeckGL } from 'deck.gl';
import { useMapStore } from '@/stores/map-store';
import { getMapStyleUrl } from '@/core/map/map-styles';
import { useUIStore } from '@/stores/ui-store';

export function MapContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const latitude = useMapStore((s) => s.latitude);
  const longitude = useMapStore((s) => s.longitude);
  const zoom = useMapStore((s) => s.zoom);
  const pitch = useMapStore((s) => s.pitch);
  const bearing = useMapStore((s) => s.bearing);
  const mapStyle = useMapStore((s) => s.mapStyle);
  const setViewport = useMapStore((s) => s.setViewport);

  // Monitor panels to trigger map resize
  const leftOpen = useUIStore((s) => s.leftPanelOpen);
  const rightOpen = useUIStore((s) => s.rightPanelOpen);
  const bottomOpen = useUIStore((s) => s.bottomDrawerOpen);
  const leftWidth = useUIStore((s) => s.leftPanelWidth);
  const rightWidth = useUIStore((s) => s.rightPanelWidth);
  const bottomHeight = useUIStore((s) => s.bottomDrawerHeight);

  const styleUrl = getMapStyleUrl(mapStyle);

  // 1. Initialize MapLibre
  useEffect(() => {
    if (!containerRef.current) return;

    // Create map instance (not interactive, Deck.gl will handle gestures)
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [longitude, latitude],
      zoom: zoom,
      pitch: pitch,
      bearing: bearing,
      interactive: false,
      attributionControl: false,
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // Mount only once

  // 2. Sync map style
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setStyle(styleUrl);
    }
  }, [styleUrl]);

  // 3. Sync MapLibre viewport with store updates (which come from Deck.gl or controls)
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.jumpTo({
        center: [longitude, latitude],
        zoom,
        pitch,
        bearing,
      });
    }
  }, [longitude, latitude, zoom, pitch, bearing]);

  // 4. Trigger map resize when panels or window dimensions change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    }, 100); // Small timeout to wait for panel animations/reflows

    return () => clearTimeout(timer);
  }, [leftOpen, rightOpen, bottomOpen, leftWidth, rightWidth, bottomHeight]);

  // 5. Handle Deck.gl interaction events
  const handleViewStateChange = (params: { viewState: any }) => {
    const { viewState } = params;
    setViewport({
      longitude: viewState.longitude,
      latitude: viewState.latitude,
      zoom: viewState.zoom,
      pitch: viewState.pitch,
      bearing: viewState.bearing,
    });
  };

  const viewState = {
    longitude,
    latitude,
    zoom,
    pitch,
    bearing,
    maxPitch: 60,
    minZoom: 0,
    maxZoom: 24,
  };

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-bg-primary">
      {/* Basemap container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Deck.gl interaction layer */}
      <DeckGL
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
        controller={{
          doubleClickZoom: true,
          dragRotate: true, // Right click + drag or Ctrl + drag for 3D rotation
          touchRotate: true,
        }}
        layers={[]}
        getCursor={({ isDragging }) => (isDragging ? 'grabbing' : 'grab')}
      />
    </div>
  );
}
export default MapContainer;
