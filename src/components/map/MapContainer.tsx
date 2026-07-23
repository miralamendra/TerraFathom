import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { DeckGL, FlyToInterpolator, GeoJsonLayer, TileLayer, BitmapLayer } from 'deck.gl';
import { useMapStore } from '@/stores/map-store';
import { getMapStyleUrl } from '@/core/map/map-styles';
import { useUIStore } from '@/stores/ui-store';
import { useDataStore } from '@/stores/data-store';
import { useDeckLayers } from '@/hooks/use-deck-layers';
import { useMapTooltip } from '@/hooks/use-map-tooltip';
import { toast } from 'sonner';

import { setMapInstance } from '@/core/map/map-instance';
import { registerPMTilesProtocol } from '@/services/space-syntax-pmtiles';

// Register PMTiles protocol once using documented API
registerPMTilesProtocol();

// easeInOutCubic transition easing function
const easeInOutCubic = (t: number) => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export function MapContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const dragStartRef = useRef<[number, number] | null>(null);

  const latitude = useMapStore((s) => s.latitude);
  const longitude = useMapStore((s) => s.longitude);
  const zoom = useMapStore((s) => s.zoom);
  const pitch = useMapStore((s) => s.pitch);
  const bearing = useMapStore((s) => s.bearing);
  const mapStyle = useMapStore((s) => s.mapStyle);
  const transitionDuration = useMapStore((s) => s.transitionDuration);
  const setViewport = useMapStore((s) => s.setViewport);
  const earthEngineTileUrl = useMapStore((s) => s.earthEngineTileUrl);

  const datasets = useDataStore((s) => s.datasets);
  const datasetCount = Object.keys(datasets).length;

  const selectionMode = useUIStore((s) => s.selectionMode);
  const selectionCoords = useUIStore((s) => s.selectionCoordinates);
  const setSelectionCoords = useUIStore((s) => s.setSelectionCoordinates);
  const setSelectionMode = useUIStore((s) => s.setSelectionMode);

  const leftOpen = useUIStore((s) => s.leftPanelOpen);
  const rightOpen = useUIStore((s) => s.rightPanelOpen);
  const bottomOpen = useUIStore((s) => s.bottomDrawerOpen);
  const leftWidth = useUIStore((s) => s.leftPanelWidth);
  const rightWidth = useUIStore((s) => s.rightPanelWidth);
  const bottomHeight = useUIStore((s) => s.bottomDrawerHeight);

  // Auto-resize WebGL canvas when panels fold or resize for crisp native high-DPI rendering
  useEffect(() => {
    const triggerResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    };

    triggerResize();
    const t1 = setTimeout(triggerResize, 50);
    const t2 = setTimeout(triggerResize, 150);
    const t3 = setTimeout(triggerResize, 300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [leftOpen, rightOpen, bottomOpen, leftWidth, rightWidth, bottomHeight]);

  // Direct ResizeObserver on map container DIV for instant resolution sync
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const deckLayers = useDeckLayers();
  const styleUrl = getMapStyleUrl(mapStyle);

  const setHoverInfo = useMapTooltip((s) => s.setHoverInfo);
  const setSelectedRowIndex = useUIStore((s) => s.setSelectedRowIndex);

  const handleClick = (info: any) => {
    if (selectionMode === 'point' && info.coordinate) {
      setSelectionCoords([info.coordinate]);
      toast.success('Point selection registered.');
      return;
    }

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
      pixelRatio: Math.max(2, window.devicePixelRatio || 1),
    });

    mapRef.current = map;
    setMapInstance(map);

    // Feature click & hover listeners for MapLibre vector road layers
    const onLayerClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (e.features && e.features.length > 0) {
        const feat = e.features[0];
        const props = feat.properties || {};
        const rowId = typeof props.__id === 'number' ? props.__id : (props.segment_id ?? props.ID ?? props.id);
        if (rowId !== undefined) {
          useUIStore.setState({ selectedRowIndex: Number(rowId), bottomDrawerOpen: true });
          const metricVal = props.choice_500m || props.choice_10k || props.choice || props.BtA500 || 0;
          toast.success(`Selected Road Segment #${rowId} (Choice: ${Number(metricVal).toFixed(2)})`);
        }
      }
    };

    const onMouseEnter = () => {
      if (containerRef.current) containerRef.current.style.cursor = 'pointer';
    };
    const onMouseLeave = () => {
      if (containerRef.current) containerRef.current.style.cursor = '';
    };

    map.on('click', 'space-syntax-pmtiles-layer', onLayerClick);
    map.on('mouseenter', 'space-syntax-pmtiles-layer', onMouseEnter);
    map.on('mouseleave', 'space-syntax-pmtiles-layer', onMouseLeave);

    return () => {
      map.off('click', 'space-syntax-pmtiles-layer', onLayerClick);
      map.off('mouseenter', 'space-syntax-pmtiles-layer', onMouseEnter);
      map.off('mouseleave', 'space-syntax-pmtiles-layer', onMouseLeave);
      setMapInstance(null);
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

  // Drawing gesture handlers
  const handleDragStart = (info: any) => {
    setHoverInfo(null);
    if (selectionMode === 'none') return;
    
    const coord = info.coordinate as [number, number];
    if (coord) {
      dragStartRef.current = coord;
      setSelectionCoords([coord]);
    }
  };

  const handleDrag = (info: any) => {
    if (selectionMode === 'none' || !dragStartRef.current) return;

    const curr = info.coordinate as [number, number];
    if (!curr) return;

    if (selectionMode === 'rectangle') {
      const start = dragStartRef.current;
      const rect = [
        start,
        [curr[0], start[1]],
        curr,
        [start[0], curr[1]],
        start
      ] as [number, number][];
      setSelectionCoords(rect);
    } else if (selectionMode === 'freehand') {
      setSelectionCoords([...selectionCoords, curr]);
    }
  };

  const handleDragEnd = () => {
    if (selectionMode === 'none') return;
    dragStartRef.current = null;
    setSelectionMode('none');
    toast.success('Selection boundary registered.');
  };

  // Build selection preview layer overlay
  let selectionLayer: GeoJsonLayer | null = null;
  if (selectionCoords.length > 0) {
    let geojson: any = null;
    if (selectionMode === 'point') {
      geojson = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: selectionCoords[0]
        }
      };
    } else if (selectionCoords.length > 2) {
      geojson = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [selectionCoords]
        }
      };
    }

    if (geojson) {
      selectionLayer = new GeoJsonLayer({
        id: 'selection-overlay-layer',
        data: geojson,
        getFillColor: [200, 164, 106, 30], // 30% opacity warm brass
        getLineColor: [200, 164, 106, 220],
        getLineWidth: 2,
      });
    }
  }

  const eeTileLayer = earthEngineTileUrl
    ? new TileLayer({
        id: 'gee-tile-layer',
        data: earthEngineTileUrl,
        minZoom: 0,
        maxZoom: 22,
        tileSize: 256,
        renderSubLayers: (props: any) => {
          const { west, south, east, north } = props.tile.bbox;
          return new BitmapLayer(props, {
            data: undefined,
            image: props.data,
            bounds: [west, south, east, north],
          });
        },
      })
    : null;

  const layersList = [
    ...(eeTileLayer ? [eeTileLayer] : []),
    ...deckLayers,
    ...(selectionLayer ? [selectionLayer] : [])
  ];

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-bg-primary">
      {/* MapLibre Canvas */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Deck.gl Canvas */}
      <DeckGL
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
        controller={
          selectionMode === 'none'
            ? { doubleClickZoom: true, dragRotate: true, touchRotate: true, dragPan: true }
            : { doubleClickZoom: false, dragRotate: false, touchRotate: false, dragPan: false }
        }
        layers={layersList}
        getCursor={({ isDragging }) => (isDragging ? 'grabbing' : 'grab')}
        onHover={handleHover}
        onClick={handleClick}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
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
