import { Plus, Minus, Navigation } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { useMapStore } from '@/stores/map-store';

export function MapControls() {
  const zoom = useMapStore((s) => s.zoom);
  const bearing = useMapStore((s) => s.bearing);
  const is3D = useMapStore((s) => s.is3D);
  const setViewport = useMapStore((s) => s.setViewport);
  const toggle3D = useMapStore((s) => s.toggle3D);
  const resetNorth = useMapStore((s) => s.resetNorth);

  const handleZoomIn = () => setViewport({ zoom: zoom + 0.5 });
  const handleZoomOut = () => setViewport({ zoom: zoom - 0.5 });

  return (
    <div className="absolute right-4 bottom-4 flex flex-col gap-1.5 z-30 select-none">
      {/* Zoom In */}
      <IconButton
        variant="secondary"
        size="md"
        onClick={handleZoomIn}
        title="Zoom In"
        className="shadow-md bg-bg-secondary border-border-primary hover:bg-bg-hover active:bg-bg-active"
      >
        <Plus size={16} />
      </IconButton>

      {/* Zoom Out */}
      <IconButton
        variant="secondary"
        size="md"
        onClick={handleZoomOut}
        title="Zoom Out"
        className="shadow-md bg-bg-secondary border-border-primary hover:bg-bg-hover active:bg-bg-active"
      >
        <Minus size={16} />
      </IconButton>

      {/* Reset North */}
      <IconButton
        variant="secondary"
        size="md"
        onClick={resetNorth}
        title="Reset North"
        className="shadow-md bg-bg-secondary border-border-primary hover:bg-bg-hover active:bg-bg-active"
      >
        <Navigation
          size={16}
          style={{ transform: `rotate(${bearing}deg)` }}
          className="transition-transform duration-150 text-accent"
        />
      </IconButton>

      {/* 3D / Pitch Toggle */}
      <IconButton
        variant={is3D ? 'primary' : 'secondary'}
        size="md"
        onClick={toggle3D}
        title={is3D ? 'Toggle 2D View' : 'Toggle 3D Perspective'}
        className="shadow-md"
      >
        <span className="text-[10px] font-bold tracking-tight">3D</span>
      </IconButton>
    </div>
  );
}
