import { useState } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { useMapStore } from '@/stores/map-store';
import { useDataStore } from '@/stores/data-store';
import { processDataset } from '@/core/data/processors/data-processor';
import { CloudRain, Globe, Sun, Compass, Loader2, AlertTriangle, ShieldCheck, Map, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../ui/utils';

interface LayerOption {
  id: string;
  name: string;
  icon: any;
  color: string;
  description: string;
}

const LAYERS: LayerOption[] = [
  {
    id: 'elevation',
    name: 'Terrain Elevation (DEM)',
    icon: Compass,
    color: '#2b83ba',
    description: 'USGS SRTM GL1 digital elevation model'
  },
  {
    id: 'ndvi',
    name: 'Vegetation Canopy (NDVI)',
    icon: CloudRain,
    color: '#018571',
    description: 'Sentinel-2 Normalized Difference Vegetation Index'
  },
  {
    id: 'nightlights',
    name: 'Nighttime Radiance',
    icon: Sun,
    color: '#ffaa00',
    description: 'VIIRS Day/Night Band monthly composite'
  },
  {
    id: 'landcover',
    name: 'Landcover Classification',
    icon: Map,
    color: '#f00000',
    description: 'ESA WorldCover 10m land cover map'
  }
];

export function EarthEngineAnalysis() {
  const selectionCoords = useUIStore((s) => s.selectionCoordinates);
  const setEarthEngineTileUrl = useMapStore((s) => s.setEarthEngineTileUrl);

  const [loadingLayerId, setLoadingLayerId] = useState<string | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [activeLegend, setActiveLegend] = useState<any[]>([]);
  const [activeSource, setActiveSource] = useState<string>('');
  const [activeMode, setActiveMode] = useState<string>('');
  const [fallbackDatasetId, setFallbackDatasetId] = useState<string | null>(null);

  const handleToggleLayer = async (layerId: string) => {
    // 1. If clicking the active layer, disable it and clear states
    if (activeLayerId === layerId) {
      handleClearLayer();
      return;
    }

    if (selectionCoords.length === 0) {
      toast.error('Please select or draw a bounding box/polygon on the map first.');
      return;
    }

    setLoadingLayerId(layerId);
    const toastId = toast.loading(`Loading satellite layer: ${layerId}...`);

    try {
      // Build closed polygon geometry
      const first = selectionCoords[0];
      const last = selectionCoords[selectionCoords.length - 1];
      const coords = [...selectionCoords];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coords.push(first);
      }
      const geometry = {
        type: 'Polygon',
        coordinates: [coords]
      };

      const response = await fetch('/api/v1/urban-engine/earth-engine/map-id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ geometry, layer_type: layerId })
      });

      if (!response.ok) {
        throw new Error('Satellite map layer request failed.');
      }

      const res = await response.json();
      
      // Clean up previous layer/dataset if present
      handleClearLayer(false);

      setActiveLayerId(layerId);
      setActiveLegend(res.legend || []);
      setActiveSource(res.source || '');
      setActiveMode(res.mode || '');

      if (res.mode === 'live_tiles' && res.tile_url) {
        setEarthEngineTileUrl(res.tile_url);
        toast.success(`Rendered live satellite tiles for ${layerId}!`, { id: toastId });
      } else if (res.mode === 'fallback_grid' && res.geojson) {
        const datasetId = `satellite-layer-${layerId}`;
        const layerThemeColor = LAYERS.find((l) => l.id === layerId)?.color || '#2b83ba';
        
        // Parse into ProcessedDataset
        const contentStr = JSON.stringify(res.geojson);
        const processed = processDataset(
          `Satellite ${layerId.toUpperCase()}`,
          contentStr,
          'geojson',
          layerThemeColor
        );
        processed.id = datasetId;

        // Add to dataStore (will trigger default GeoJSON layer in layerStore)
        useDataStore.getState().addDataset(processed);
        setFallbackDatasetId(datasetId);

        toast.success(`Rendered fallback grid visualization for ${layerId}!`, { id: toastId });
      } else {
        throw new Error('Invalid map overlay mode returned from server.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Layer loading failed';
      toast.error(msg, { id: toastId });
    } finally {
      setLoadingLayerId(null);
    }
  };

  const handleClearLayer = (resetActiveId = true) => {
    setEarthEngineTileUrl(null);
    if (fallbackDatasetId) {
      useDataStore.getState().removeDataset(fallbackDatasetId);
      setFallbackDatasetId(null);
    }
    if (resetActiveId) {
      setActiveLayerId(null);
      setActiveLegend([]);
      setActiveSource('');
      setActiveMode('');
    }
  };

  const hasSelection = selectionCoords.length > 0;

  return (
    <div className="flex flex-col gap-4 p-4 rounded-control border border-border-primary bg-bg-secondary shadow-tight">
      <div className="flex items-center justify-between border-b border-border-primary/50 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent/10 flex items-center justify-center text-accent">
            <Globe size={14} />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-text-primary">Satellite Visualizations</span>
            <span className="text-[10px] text-text-tertiary">Google Earth Engine Integration</span>
          </div>
        </div>
        {activeLayerId && (
          <button
            type="button"
            onClick={() => handleClearLayer()}
            className="text-[10px] font-semibold text-text-tertiary hover:text-[#eb5757] transition-colors cursor-pointer flex items-center gap-1"
          >
            <EyeOff size={11} />
            <span>Clear Layer</span>
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-text-secondary leading-relaxed">
          Select a satellite imagery layer to project onto the map canvas. Requires an active map boundary selection.
        </p>

        {/* Bounding box nudge */}
        {!hasSelection && (
          <div className="flex items-center gap-2.5 p-2.5 rounded bg-amber-500/5 border border-amber-500/10 text-[11px] text-amber-500/80 leading-normal">
            <AlertTriangle size={14} className="shrink-0" />
            <span>Please draw a polygon boundary or box on the map to unlock visual layers.</span>
          </div>
        )}

        {/* Layers List Selector */}
        <div className="flex flex-col gap-2">
          {LAYERS.map((layer) => {
            const Icon = layer.icon;
            const isActive = activeLayerId === layer.id;
            const isLoading = loadingLayerId === layer.id;

            return (
              <button
                key={layer.id}
                type="button"
                disabled={!hasSelection || (loadingLayerId !== null && !isLoading)}
                onClick={() => handleToggleLayer(layer.id)}
                className={cn(
                  "w-full p-2.5 flex items-start justify-between rounded-control border text-left transition-all cursor-pointer",
                  isActive
                    ? "bg-bg-tertiary border-accent/60 shadow-sm"
                    : "bg-bg-secondary/40 border-border-primary/45 hover:bg-bg-hover hover:border-border-primary",
                  !hasSelection && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-start gap-2.5">
                  <div 
                    className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${layer.color}15`, color: layer.color }}
                  >
                    <Icon size={12} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-text-primary leading-tight">
                      {layer.name}
                    </span>
                    <span className="text-[10px] text-text-tertiary mt-0.5 leading-normal">
                      {layer.description}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 pt-0.5 pl-2">
                  {isLoading ? (
                    <Loader2 size={13} className="animate-spin text-accent" />
                  ) : isActive ? (
                    <span className="text-[9px] font-bold text-accent uppercase tracking-wider bg-accent/15 px-1.5 py-0.5 rounded">
                      Active
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Layer Details, Source and Legend */}
      {activeLayerId && (
        <div className="flex flex-col gap-3.5 mt-1 pt-3.5 border-t border-border-primary/50 animate-in fade-in duration-300">
          <div className={cn(
            "flex items-start gap-2 p-2.5 rounded border text-[10px] leading-relaxed",
            activeMode === 'fallback_grid'
              ? "bg-[#dca11d]/10 border-[#dca11d]/20 text-[#dca11d]"
              : "bg-[#27a644]/10 border-[#27a644]/20 text-[#27a644]"
          )}>
            {activeMode === 'fallback_grid' ? (
              <>
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="font-semibold uppercase tracking-wider">Fallback Render Mode</span>
                  <span>{activeSource}</span>
                </div>
              </>
            ) : (
              <>
                <ShieldCheck size={14} className="shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="font-semibold uppercase tracking-wider">Live Earth Engine Overlay</span>
                  <span>{activeSource}</span>
                </div>
              </>
            )}
          </div>

          {/* Color Ramp Legend */}
          <div className="flex flex-col gap-2 p-3 rounded bg-bg-tertiary/20 border border-border-primary/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              Visual Color Scale
            </span>
            <div className="flex flex-col gap-1.5">
              {activeLegend.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3.5 h-3.5 rounded-sm border border-border-primary/20 shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[10px] text-text-secondary">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
