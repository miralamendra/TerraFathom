import { useRef, useState } from 'react';
import { PanelLeft, PanelBottom, PanelRight, Plus, Search, Sun, Moon, Bot } from 'lucide-react';
import { Button, IconButton, Select } from '@/components/ui';
import { useUIStore } from '@/stores/ui-store';
import { useMapStore } from '@/stores/map-store';
import { MAP_STYLES } from '@/constants/map-styles';
import { useFileDrop } from '@/hooks/use-file-drop';
import { cn } from '@/components/ui/utils';
import { TerraFathomLogo } from '../ui/TerraFathomLogo';

interface ToolbarProps {
  onLogoClick?: () => void;
}

export function Toolbar({ onLogoClick }: ToolbarProps) {
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const bottomDrawerOpen = useUIStore((s) => s.bottomDrawerOpen);
  const isChatOpen = useUIStore((s) => s.isChatOpen);

  const toggleLeft = useUIStore((s) => s.toggleLeftPanel);
  const toggleRight = useUIStore((s) => s.toggleRightPanel);
  const toggleBottom = useUIStore((s) => s.toggleBottomDrawer);
  const toggleChat = useUIStore((s) => s.toggleChat);

  const activeStyle = useMapStore((s) => s.mapStyle);
  const setMapStyle = useMapStore((s) => s.setMapStyle);

  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const fileDrop = useFileDrop();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('geospatial-platform-theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('geospatial-platform-theme', 'dark');
      setIsDark(true);
    }
  };

  const handleAddDataClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <header className="h-12 w-full flex items-center justify-between px-4 bg-bg-secondary border-b border-border-primary select-none z-40 shrink-0">
      <input
        type="file"
        ref={fileInputRef}
        onChange={fileDrop.handleFileChange}
        accept=".csv,.geojson,application/json"
        className="hidden"
      />

      <div 
        onClick={onLogoClick}
        className="flex items-center gap-3 select-none cursor-pointer hover:opacity-90 active:scale-95 transition-all"
        title="Go to Landing Page"
      >
        <TerraFathomLogo size={18} />
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold text-[13px] tracking-[-0.01em] text-text-primary">
            TerraFathom
          </span>
          <span className="text-[10px] font-mono text-text-tertiary select-none">
            v1.0
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="w-44">
          <Select
            variant="ghost"
            className="h-8 text-xs font-medium"
            value={activeStyle}
            onChange={(e) => setMapStyle(e.target.value)}
            options={MAP_STYLES.map((style) => ({
               value: style.id,
               label: style.label,
            }))}
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddDataClick}
          className="h-8 flex items-center gap-1.5 px-3 rounded-control font-medium text-xs active:scale-95 transition-all select-none cursor-pointer text-text-secondary hover:text-text-primary hover:bg-bg-hover"
        >
          <Plus size={14} className="text-text-secondary" />
          <span>Add Data</span>
        </Button>

        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="h-8 px-2 flex items-center gap-1.5 rounded-control text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors text-xs font-medium cursor-pointer"
        >
          <Search size={14} className="text-text-tertiary" />
          <span>Search...</span>
          <span className="text-[10px] text-text-tertiary font-mono select-none ml-0.5">⌘K</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <IconButton
          variant="ghost"
          onClick={toggleTheme}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="w-8 h-8 flex items-center justify-center rounded-control text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>
        <IconButton
          variant="ghost"
          onClick={toggleLeft}
          title="Toggle Left Panel"
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-control transition-colors cursor-pointer",
            leftPanelOpen
              ? "bg-bg-active text-text-primary"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
          )}
        >
          <PanelLeft size={16} />
        </IconButton>
        <IconButton
          variant="ghost"
          onClick={toggleBottom}
          title="Toggle Bottom Drawer"
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-control transition-colors cursor-pointer",
            bottomDrawerOpen
              ? "bg-bg-active text-text-primary"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
          )}
        >
          <PanelBottom size={16} />
        </IconButton>
        <IconButton
          variant="ghost"
          onClick={toggleRight}
          title="Toggle Right Panel"
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-control transition-colors cursor-pointer",
            rightPanelOpen
              ? "bg-bg-active text-text-primary"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
          )}
        >
          <PanelRight size={16} />
        </IconButton>
        <IconButton
          variant="ghost"
          onClick={toggleChat}
          title="Toggle AI Assistant"
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-control transition-colors cursor-pointer",
            isChatOpen
              ? "bg-bg-active text-[#C8A46A]"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
          )}
        >
          <Bot size={16} />
        </IconButton>
      </div>
    </header>
  );
}
export default Toolbar;
