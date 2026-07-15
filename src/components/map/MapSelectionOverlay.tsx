import { useState } from 'react';
import { MousePointerClick, Square, Edit3, Building2, Trash2, Loader2 } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { useDataStore } from '@/stores/data-store';
import { useLayerStore } from '@/stores/layer-store';
import { fetchAndParseOSMBuildings } from '@/core/data/parsers/osm-parser';
import { toast } from 'sonner';

export function MapSelectionOverlay() {
  const selectionMode = useUIStore((s) => s.selectionMode);
  const setSelectionMode = useUIStore((s) => s.setSelectionMode);
  const selectionCoords = useUIStore((s) => s.selectionCoordinates);

  const addDataset = useDataStore((s) => s.addDataset);
  const addLayer = useLayerStore((s) => s.addLayer);

  const [loading, setLoading] = useState(false);

  const handleModeToggle = (mode: 'point' | 'rectangle' | 'freehand') => {
    if (selectionMode === mode) {
      setSelectionMode('none');
      toast('Drawing mode deactivated');
    } else {
      setSelectionMode(mode);
      toast.info(`Active drawing mode: ${mode.toUpperCase()}. Drag/click on map to select region.`, {
        description: 'Map navigation is temporarily locked while drawing.'
      });
    }
  };

  const handleClear = () => {
    useUIStore.setState({ selectionCoordinates: [] });
    setSelectionMode('none');
    toast.success('Selection cleared');
  };

  const handleDownloadBuildings = async () => {
    if (selectionCoords.length === 0 && selectionMode !== 'point') {
      toast.error('Please select an area on the map first.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Querying OpenStreetMap building layers...');
    try {
      let bounds: [number, number, number, number]; // [south, west, north, east]

      if (selectionMode === 'point' && selectionCoords.length > 0) {
        // Point selection: box with 500m radius (~0.004 deg lat, ~0.005 deg lng)
        const [lng, lat] = selectionCoords[0];
        bounds = [lat - 0.003, lng - 0.004, lat + 0.003, lng + 0.004];
      } else {
        // Bounding box from path coords
        const lngs = selectionCoords.map((c) => c[0]);
        const lats = selectionCoords.map((c) => c[1]);
        
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        // Safeguard against querying an excessively large boundary sector
        const areaEst = (maxLng - minLng) * (maxLat - minLat);
        if (areaEst > 0.04) {
          throw new Error('Selected boundary is too large. Please select a smaller sector (max 2km x 2km).');
        }

        bounds = [minLat, minLng, maxLat, maxLng];
      }

      // Fetch from OSM
      const dataset = await fetchAndParseOSMBuildings(bounds);
      
      // Load into store
      addDataset(dataset);
      
      // Auto-create extruded 3D GeoJSON layer
      addLayer(dataset.id, 'geojson', 'OSM 3D Buildings', {
        extruded: true,
        geojsonElevationField: 'height',
        elevationScale: 1.0,
        fillColor: [200, 164, 106], // Theme Warm Brass
        strokeColor: [43, 43, 43],
        strokeWidth: 1,
        opacity: 0.8,
      });

      // Focus on new dataset layers
      useUIStore.setState({ selectedDatasetId: dataset.id });
      
      toast.success(`Loaded ${dataset.rowCount} buildings in 3D perspective!`, { id: toastId });
      
      // Clear selection overlay after download
      useUIStore.setState({ selectionCoordinates: [] });
      setSelectionMode('none');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OSM query failed';
      toast.error(msg, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const hasSelection = selectionCoords.length > 0;

  return (
    <div className="absolute left-4 top-[175px] flex flex-col bg-bg-elevated border border-border-primary rounded-control shadow-floating z-30 select-none overflow-hidden divide-y divide-border-primary backdrop-blur-md">
      
      {/* Point Tool */}
      <button
        type="button"
        onClick={() => handleModeToggle('point')}
        title="Select Point (Click Map)"
        className={`w-8 h-8 flex items-center justify-center transition-colors outline-none cursor-pointer ${
          selectionMode === 'point'
            ? 'text-[#C8A46A] bg-[#C8A46A]/10'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
        }`}
      >
        <MousePointerClick size={15} />
      </button>

      {/* Rectangle Tool */}
      <button
        type="button"
        onClick={() => handleModeToggle('rectangle')}
        title="Select Area Box (Drag Map)"
        className={`w-8 h-8 flex items-center justify-center transition-colors outline-none cursor-pointer ${
          selectionMode === 'rectangle'
            ? 'text-[#C8A46A] bg-[#C8A46A]/10'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
        }`}
      >
        <Square size={15} />
      </button>

      {/* Freehand Tool */}
      <button
        type="button"
        onClick={() => handleModeToggle('freehand')}
        title="Draw Freehand Path (Drag Map)"
        className={`w-8 h-8 flex items-center justify-center transition-colors outline-none cursor-pointer ${
          selectionMode === 'freehand'
            ? 'text-[#C8A46A] bg-[#C8A46A]/10'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
        }`}
      >
        <Edit3 size={15} />
      </button>

      {/* Action: Query OSM Buildings */}
      <button
        type="button"
        onClick={handleDownloadBuildings}
        disabled={loading || (!hasSelection && selectionMode !== 'point')}
        title="Load OSM 3D Buildings in Bounds"
        className={`w-8 h-8 flex items-center justify-center transition-colors outline-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
          loading
            ? 'text-text-tertiary bg-bg-hover'
            : 'text-[#C8A46A] hover:bg-bg-hover'
        }`}
      >
        {loading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Building2 size={15} />
        )}
      </button>

      {/* Clear Selection */}
      {(hasSelection || selectionMode !== 'none') && (
        <button
          type="button"
          onClick={handleClear}
          title="Clear Selection"
          className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-bg-hover transition-colors outline-none cursor-pointer"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

export default MapSelectionOverlay;
