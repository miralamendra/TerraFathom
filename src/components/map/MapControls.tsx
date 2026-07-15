import { Plus, Minus, Maximize, Box } from 'lucide-react';
import { useMapStore } from '@/stores/map-store';
import { useDataStore } from '@/stores/data-store';
import { getViewportForDataset } from '@/core/map/viewport';
import { cn } from '@/components/ui/utils';

export function MapControls() {
  const zoom = useMapStore((s) => s.zoom);
  const bearing = useMapStore((s) => s.bearing);
  const is3D = useMapStore((s) => s.is3D);
  const animateViewport = useMapStore((s) => s.animateViewport);
  const toggle3D = useMapStore((s) => s.toggle3D);
  const resetNorth = useMapStore((s) => s.resetNorth);

  const selectedDatasetId = useDataStore((s) => s.selectedDatasetId);
  const datasets = useDataStore((s) => s.datasets);
  const selectedDataset = selectedDatasetId ? datasets[selectedDatasetId] : null;

  const handleZoomIn = () => animateViewport({ zoom: zoom + 0.5 }, 300);
  const handleZoomOut = () => animateViewport({ zoom: zoom - 0.5 }, 300);

  const handleFitToData = () => {
    if (selectedDataset) {
      const newVp = getViewportForDataset(selectedDataset);
      animateViewport({
        longitude: newVp.longitude,
        latitude: newVp.latitude,
        zoom: newVp.zoom,
        pitch: is3D ? 45 : 0,
        bearing: is3D ? 15 : 0,
      }, 1500);
    }
  };

  return (
    <div className="absolute left-4 top-4 flex flex-col bg-bg-elevated border border-border-primary rounded-control shadow-floating z-30 select-none overflow-hidden divide-y divide-border-primary backdrop-blur-md">
      {/* Zoom In */}
      <button
        type="button"
        onClick={handleZoomIn}
        title="Zoom In"
        className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover active:bg-bg-active transition-colors outline-none cursor-pointer"
      >
        <Plus size={16} />
      </button>

      {/* Zoom Out */}
      <button
        type="button"
        onClick={handleZoomOut}
        title="Zoom Out"
        className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover active:bg-bg-active transition-colors outline-none cursor-pointer"
      >
        <Minus size={16} />
      </button>

      {/* Compass Needle (Rotates bearing, resets bearing = 0° on click with 300ms transition) */}
      <button
        type="button"
        onClick={resetNorth}
        title="Reset North (Compass)"
        className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover active:bg-bg-active transition-colors outline-none cursor-pointer relative"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          className="transition-transform duration-300 ease-out"
          style={{ transform: `rotate(${-bearing}deg)` }}
        >
          {/* North needle */}
          <path d="M12,2 L12,12 L6,12 Z" fill="#E6E8F0" />
          <path d="M12,2 L18,12 L12,12 Z" fill="#E6E8F0" />
          {/* South needle (Muted) */}
          <path d="M12,22 L12,12 L6,12 Z" fill="#5F6578" />
          <path d="M12,22 L18,12 L12,12 Z" fill="#5F6578" />
        </svg>
      </button>

      {/* 3D Perspective Toggle */}
      <button
        type="button"
        onClick={toggle3D}
        title={is3D ? 'Toggle 2D View' : 'Toggle 3D Perspective'}
        className={cn(
          'w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover active:bg-bg-active transition-colors outline-none cursor-pointer',
          is3D && 'text-accent bg-bg-active'
        )}
      >
        <Box size={16} />
      </button>

      {/* Fit to Data Bounds */}
      <button
        type="button"
        onClick={handleFitToData}
        disabled={!selectedDataset}
        title="Fit Camera to Dataset"
        className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover active:bg-bg-active disabled:opacity-30 disabled:pointer-events-none transition-colors outline-none cursor-pointer"
      >
        <Maximize size={16} />
      </button>
    </div>
  );
}
export default MapControls;
