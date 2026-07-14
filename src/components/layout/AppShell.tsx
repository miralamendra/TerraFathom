import { useUIStore } from '@/stores/ui-store';
import { usePanelResize } from '@/hooks/use-panel-resize';
import { Toolbar } from './Toolbar';
import { LeftPanel } from './LeftPanel';
import { RightPanel } from './RightPanel';
import { BottomDrawer } from './BottomDrawer';
import { PanelResizer } from './PanelResizer';
import { MapContainer } from '@/components/map/MapContainer';
import { MapControls } from '@/components/map/MapControls';

export function AppShell() {
  const leftOpen = useUIStore((s) => s.leftPanelOpen);
  const rightOpen = useUIStore((s) => s.rightPanelOpen);
  const bottomOpen = useUIStore((s) => s.bottomDrawerOpen);

  const resizeLeft = usePanelResize('left');
  const resizeRight = usePanelResize('right');
  const resizeBottom = usePanelResize('bottom');

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-primary text-text-primary overflow-hidden font-sans select-none">
      {/* 1. Top Toolbar */}
      <Toolbar />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex min-h-0 w-full relative">
        
        {/* Left Structure Panel */}
        <LeftPanel />

        {/* Left Panel Resizer */}
        {leftOpen && <PanelResizer orientation="vertical" onMouseDown={resizeLeft} />}

        {/* Center Stage & Bottom Drawer Area */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          
          {/* Map Viewport Area */}
          <main className="flex-1 relative bg-bg-primary overflow-hidden">
            {/* Live Map Engine */}
            <MapContainer />

            {/* Map Action Controls */}
            <MapControls />
          </main>

          {/* Bottom Panel Resizer */}
          {bottomOpen && <PanelResizer orientation="horizontal" onMouseDown={resizeBottom} />}

          {/* Bottom Drawer */}
          <BottomDrawer />

        </div>

        {/* Right Panel Resizer */}
        {rightOpen && <PanelResizer orientation="vertical" onMouseDown={resizeRight} />}

        {/* Right Properties Panel */}
        <RightPanel />

      </div>
    </div>
  );
}
