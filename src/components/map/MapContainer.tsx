import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { DeckGL, FlyToInterpolator } from 'deck.gl';
import { useMapStore } from '@/stores/map-store';
import { getMapStyleUrl } from '@/core/map/map-styles';
import { useUIStore } from '@/stores/ui-store';
import { useDataStore } from '@/stores/data-store';
import { useDeckLayers } from '@/hooks/use-deck-layers';
import { useMapTooltip } from '@/hooks/use-map-tooltip';

// easeInOutCubic transition easing function
const easeInOutCubic = (t: number) => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export function MapContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const latitude = useMapStore((s) => s.latitude);
  const longitude = useMapStore((s) => s.longitude);
  const zoom = useMapStore((s) => s.zoom);
  const pitch = useMapStore((s) => s.pitch);
  const bearing = useMapStore((s) => s.bearing);
  const mapStyle = useMapStore((s) => s.mapStyle);
  const transitionDuration = useMapStore((s) => s.transitionDuration);
  const setViewport = useMapStore((s) => s.setViewport);

  const datasets = useDataStore((s) => s.datasets);
  const datasetCount = Object.keys(datasets).length;

  const leftOpen = useUIStore((s) => s.leftPanelOpen);
  const rightOpen = useUIStore((s) => s.rightPanelOpen);
  const bottomOpen = useUIStore((s) => s.bottomDrawerOpen);
  const leftWidth = useUIStore((s) => s.leftPanelWidth);
  const rightWidth = useUIStore((s) => s.rightPanelWidth);
  const bottomHeight = useUIStore((s) => s.bottomDrawerHeight);

  const deckLayers = useDeckLayers();
  const styleUrl = getMapStyleUrl(mapStyle);

  const setHoverInfo = useMapTooltip((s) => s.setHoverInfo);
  const setSelectedRowIndex = useUIStore((s) => s.setSelectedRowIndex);

  const handleClick = (info: {
    object?: Record<string, any>;
  }) => {
    if (info.object) {
      // Check if it's a GeoJSON feature or a raw record
      const record = info.object.properties ? info.object.properties : info.object;
      const rowId = record.__id;
      if (typeof rowId === 'number') {
        setSelectedRowIndex(rowId);
        // Force the bottom drawer to open if closed to view the highlighted row
        useUIStore.setState({ bottomDrawerOpen: true });
      }
    }
  };

  // 1. Initialize MapLibre
  useEffect(() => {
    if (!containerRef.current) return;

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
  }, []); // Mount once

  // 2. Sync style
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setStyle(styleUrl);
    }
  }, [styleUrl]);

  // 3. Sync viewport frame-by-frame
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

  // 4. Handle resize reflow
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [leftOpen, rightOpen, bottomOpen, leftWidth, rightWidth, bottomHeight]);

  // 5. Deck.gl transition-aware gesture handler
  const handleViewStateChange = (params: { 
    viewState: Record<string, unknown>;
    interactionState: {
      isDragging?: boolean;
      isPanning?: boolean;
      isZooming?: boolean;
      isRotating?: boolean;
      inTransition?: boolean;
    };
  }) => {
    const { viewState, interactionState } = params;
    const isInteracting = 
      interactionState.isDragging || 
      interactionState.isPanning || 
      interactionState.isZooming || 
      interactionState.isRotating;

    if (isInteracting) {
      // Manual input: update store viewport and reset transitionDuration
      setViewport({
        longitude: Number(viewState.longitude),
        latitude: Number(viewState.latitude),
        zoom: Number(viewState.zoom),
        pitch: Number(viewState.pitch),
        bearing: Number(viewState.bearing),
      });
    } else if (interactionState.inTransition) {
      // During active animation ticks, update coordinates directly without resetting transitionDuration
      useMapStore.setState({
        longitude: Number(viewState.longitude),
        latitude: Number(viewState.latitude),
        zoom: Number(viewState.zoom),
        pitch: Number(viewState.pitch),
        bearing: Number(viewState.bearing),
      });
    }
  };

  const handleHover = (info: {
    x: number;
    y: number;
    object?: Record<string, unknown>;
    layer?: unknown;
  }) => {
    if (info.object) {
      const rawLayer = info.layer as { id: string; props: { id: string } } | null | undefined;
      setHoverInfo({
        x: info.x,
        y: info.y,
        object: info.object,
        layer: rawLayer ? {
          id: rawLayer.id,
          props: { id: rawLayer.props.id },
        } : undefined,
      });
    } else {
      setHoverInfo(null);
    }
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
    // Add transition triggers
    transitionDuration,
    transitionInterpolator: transitionDuration > 0 ? new FlyToInterpolator() : undefined,
    transitionEasing: transitionDuration > 0 ? easeInOutCubic : undefined,
    onTransitionEnd: () => {
      if (useMapStore.getState().transitionDuration > 0) {
        useMapStore.setState({ transitionDuration: 0 });
      }
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-bg-primary">
      {/* MapLibre Canvas */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Deck.gl Canvas */}
      <DeckGL
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
        controller={{
          doubleClickZoom: true,
          dragRotate: true,
          touchRotate: true,
        }}
        layers={deckLayers}
        getCursor={({ isDragging }) => (isDragging ? 'grabbing' : 'grab')}
        onHover={handleHover}
        onClick={handleClick}
        onDragStart={() => setHoverInfo(null)}
      />

      {/* Quiet, unboxed empty state nudge bottom-left */}
      {datasetCount === 0 && (
        <div className="absolute bottom-4 left-4 pointer-events-none z-20 animate-fade-in select-none">
          <span className="text-[11px] font-medium text-text-tertiary">
            Load a dataset to begin.
          </span>
        </div>
      )}
    </div>
  );
}
export default MapContainer;
