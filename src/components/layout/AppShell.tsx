import { useUIStore } from '@/stores/ui-store';
import { usePanelResize } from '@/hooks/use-panel-resize';
import { useKeyboard } from '@/hooks/use-keyboard';
import { Toolbar } from './Toolbar';
import { LeftPanel } from './LeftPanel';
import { BottomDrawer } from './BottomDrawer';
import { PanelResizer } from './PanelResizer';
import { MapContainer } from '@/components/map/MapContainer';
import { MapControls } from '@/components/map/MapControls';
import { MapLegend } from '@/components/map/MapLegend';
import { MapTooltip } from '@/components/map/MapTooltip';
import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { LayerInspector } from '@/components/layers/LayerInspector';

interface AppShellProps {
  onBackToLanding?: () => void;
}

export function AppShell({ onBackToLanding }: AppShellProps) {
  useKeyboard();

  const leftOpen = useUIStore((s) => s.leftPanelOpen);
  const bottomOpen = useUIStore((s) => s.bottomDrawerOpen);
  const rightOpen = useUIStore((s) => s.rightPanelOpen);
  const bottomHeight = useUIStore((s) => s.bottomDrawerHeight);

  const resizeLeft = usePanelResize('left');
  const resizeRight = usePanelResize('right');
  const resizeBottom = usePanelResize('bottom');

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-primary text-text-primary overflow-hidden font-sans select-none relative">
      <Toolbar onLogoClick={onBackToLanding} />

      <div className="flex-1 flex min-h-0 w-full relative">
        <LeftPanel />

        {leftOpen && <PanelResizer orientation="vertical" onMouseDown={resizeLeft} />}

        <div className="flex-1 min-w-0 relative">
          {/* Full-bleed map workspace to eliminate canvas resizing/elastic distortion */}
          <main className="absolute inset-0 bg-bg-primary overflow-hidden">
            <MapContainer />
            <MapControls />
            <MapLegend />
            <MapTooltip />
          </main>

          {bottomOpen && (
            <PanelResizer
              orientation="horizontal"
              onMouseDown={resizeBottom}
              className="absolute left-0 right-0 z-40"
              style={{ bottom: bottomHeight }}
            />
          )}
          <BottomDrawer />
        </div>

        {rightOpen && <PanelResizer orientation="vertical" onMouseDown={resizeRight} />}
        {rightOpen && <LayerInspector />}
      </div>

      <CommandPalette />
    </div>
  );
}
export default AppShell;
