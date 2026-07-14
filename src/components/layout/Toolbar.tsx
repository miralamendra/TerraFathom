import { Compass, PanelLeft, PanelRight, PanelBottom, Plus, Search } from 'lucide-react';
import { Button, IconButton, Select } from '@/components/ui';
import { useUIStore } from '@/stores/ui-store';
import { useMapStore } from '@/stores/map-store';
import { MAP_STYLES } from '@/constants/map-styles';

export function Toolbar() {
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const bottomDrawerOpen = useUIStore((s) => s.bottomDrawerOpen);

  const toggleLeft = useUIStore((s) => s.toggleLeftPanel);
  const toggleRight = useUIStore((s) => s.toggleRightPanel);
  const toggleBottom = useUIStore((s) => s.toggleBottomDrawer);

  const activeStyle = useMapStore((s) => s.mapStyle);
  const setMapStyle = useMapStore((s) => s.setMapStyle);

  return (
    <header className="h-12 w-full flex items-center justify-between px-4 bg-bg-secondary border-b border-border-primary select-none z-40 shrink-0">
      
      {/* Brand logo/wordmark area */}
      <div className="flex items-center gap-2">
        <Compass className="text-accent" size={18} />
        <span className="font-semibold text-sm tracking-tight text-text-primary">
          Antigravity <span className="text-text-tertiary font-normal">Geospatial</span>
        </span>
      </div>

      {/* Middle: Map style selector, Add Data, Cmd+K hint */}
      <div className="flex items-center gap-4">
        {/* Map Style Selector */}
        <div className="w-48">
          <Select
            className="h-8"
            value={activeStyle}
            onChange={(e) => setMapStyle(e.target.value)}
            options={MAP_STYLES.map((style) => ({
              value: style.id,
              label: style.label,
            }))}
          />
        </div>

        {/* Add Data Placeholder */}
        <Button variant="primary" size="sm" className="h-8 flex items-center gap-1.5">
          <Plus size={14} />
          <span>Add Data</span>
        </Button>

        {/* Cmd+K Hint */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-xs text-text-secondary select-none font-mono">
          <Search size={11} className="text-text-tertiary" />
          <span>Cmd K</span>
        </div>
      </div>

      {/* Right side: Panel toggles */}
      <div className="flex items-center gap-1">
        <IconButton
          variant={leftPanelOpen ? 'primary' : 'ghost'}
          size="sm"
          onClick={toggleLeft}
          title="Toggle Left Panel"
        >
          <PanelLeft size={16} />
        </IconButton>
        <IconButton
          variant={bottomDrawerOpen ? 'primary' : 'ghost'}
          size="sm"
          onClick={toggleBottom}
          title="Toggle Bottom Drawer"
        >
          <PanelBottom size={16} />
        </IconButton>
        <IconButton
          variant={rightPanelOpen ? 'primary' : 'ghost'}
          size="sm"
          onClick={toggleRight}
          title="Toggle Right Properties"
        >
          <PanelRight size={16} />
        </IconButton>
      </div>

    </header>
  );
}
