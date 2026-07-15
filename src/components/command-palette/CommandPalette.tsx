import { useState, useEffect, useRef } from 'react';
import {
  Search,
  Eye,
  Layers,
  Map,
  Compass,
  Sparkles,
  Command,
} from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { useMapStore } from '@/stores/map-store';
import { useDataStore } from '@/stores/data-store';
import { useLayerStore } from '@/stores/layer-store';
import { SAMPLE_DATASETS } from '@/core/data/sample-data';
import { processDataset } from '@/core/data/processors/data-processor';
import { DATASET_COLORS } from '@/core/colors/constants';
import { getLayerDefinition } from '@/core/layers/layer-registry';
import { toast } from 'sonner';
import { cn } from '@/components/ui/utils';

interface CommandAction {
  id: string;
  title: string;
  category: string;
  icon: any;
  shortcut?: string;
  run: () => void;
  disabled?: boolean;
}

export function CommandPalette() {
  const isOpen = useUIStore((s) => s.commandPaletteOpen);
  const setIsOpen = useUIStore((s) => s.setCommandPaletteOpen);

  // Stores reference bindings
  const toggleLeft = useUIStore((s) => s.toggleLeftPanel);
  const toggleBottom = useUIStore((s) => s.toggleBottomDrawer);
  
  const setMapStyle = useMapStore((s) => s.setMapStyle);
  const is3D = useMapStore((s) => s.is3D);
  const toggle3D = useMapStore((s) => s.toggle3D);

  const datasets = useDataStore((s) => s.datasets);
  const addDataset = useDataStore((s) => s.addDataset);
  const selectedDatasetId = useUIStore((s) => s.selectedDatasetId);

  const addLayer = useLayerStore((s) => s.addLayer);

  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when palette opens
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  // Compile actions list
  const actions: CommandAction[] = [];

  // Category 1: Panels
  actions.push(
    {
      id: 'toggle-left',
      title: 'Toggle Left Sidebar (Layers & Filters)',
      category: 'Layout panels',
      icon: Eye,
      shortcut: '1',
      run: () => toggleLeft(),
    },
    {
      id: 'toggle-bottom',
      title: 'Toggle Bottom Data Drawer (Table view)',
      category: 'Layout panels',
      icon: Eye,
      shortcut: '3',
      run: () => toggleBottom(),
    }
  );

  // Category 2: Map styles & projection
  actions.push(
    {
      id: 'style-dark',
      title: 'Switch Map Style: Dark professional',
      category: 'Map viewport',
      icon: Map,
      run: () => setMapStyle('dark'),
    },
    {
      id: 'style-light',
      title: 'Switch Map Style: Light clean minimal',
      category: 'Map viewport',
      icon: Map,
      run: () => setMapStyle('light'),
    },
    {
      id: 'style-outlines',
      title: 'Switch Map Style: Outline boundaries',
      category: 'Map viewport',
      icon: Map,
      run: () => setMapStyle('outlines'),
    },
    {
      id: 'style-satellite',
      title: 'Switch Map Style: Satellite imagery',
      category: 'Map viewport',
      icon: Map,
      run: () => setMapStyle('satellite'),
    },
    {
      id: 'toggle-3d',
      title: `Toggle Map Projection: ${is3D ? 'Flatten to 2D' : 'Pitch to 3D perspective'}`,
      category: 'Map viewport',
      icon: Compass,
      run: () => toggle3D(),
    }
  );

  // Category 3: Sample data loading
  const handleLoadSample = async (sampleId: string, colorIndex: number) => {
    const sample = SAMPLE_DATASETS.find((s) => s.id === sampleId);
    if (!sample) return;
    const toastId = toast.loading(`Loading sample dataset: ${sample.name}...`);
    try {
      const response = await fetch(sample.path);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const text = await response.text();
      const color = DATASET_COLORS[colorIndex % DATASET_COLORS.length].bgClass;
      const processed = processDataset(sample.name, text, sample.format, color);
      addDataset(processed);
      toast.success(`Loaded sample: ${sample.name}`, { id: toastId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to load sample: ${msg}`, { id: toastId });
    }
  };

  SAMPLE_DATASETS.forEach((sample, idx) => {
    const isLoaded = Object.values(datasets).some((d) => d.name === sample.name);
    actions.push({
      id: `load-sample-${sample.id}`,
      title: `Load Dataset Sample: ${sample.name}`,
      category: 'Offline data samples',
      icon: Sparkles,
      disabled: isLoaded,
      run: () => handleLoadSample(sample.id, idx),
    });
  });

  // Category 4: Add visualization layers (context-aware)
  const activeDatasetId = selectedDatasetId || Object.keys(datasets)[0];
  const activeDataset = activeDatasetId ? datasets[activeDatasetId] : null;

  if (activeDataset) {
    const layerTypes: ('scatterplot' | 'hexagon' | 'arc' | 'heatmap' | 'geojson')[] = [
      'scatterplot',
      'hexagon',
      'arc',
      'heatmap',
      'geojson',
    ];

    layerTypes.forEach((type) => {
      const def = getLayerDefinition(type);
      if (def) {
        const isCompatible = def.validateDataset(activeDataset);
        actions.push({
          id: `create-layer-${type}`,
          title: `Create Visual Layer: ${def.label} (${activeDataset.name})`,
          category: 'Active dataset layers creation',
          icon: Layers,
          disabled: !isCompatible,
          run: () => {
            addLayer(
              activeDataset.id,
              type,
              `${activeDataset.name} ${def.label}`
            );
            toast.success(`Created layer: ${activeDataset.name} ${def.label}`);
          },
        });
      }
    });
  }

  // Filter actions based on search
  const filteredActions = actions.filter((act) =>
    act.title.toLowerCase().includes(search.toLowerCase()) ||
    act.category.toLowerCase().includes(search.toLowerCase())
  );

  // Key navigation handlers
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredActions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredActions.length) % filteredActions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredActions[selectedIndex];
      if (selected && !selected.disabled) {
        selected.run();
        setIsOpen(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-[1px] animate-fade-in font-sans">
      <div
        ref={containerRef}
        className="w-full max-w-[520px] bg-bg-elevated border border-border-primary shadow-floating rounded-[12px] overflow-hidden flex flex-col max-h-[380px] animate-slide-up"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-5 h-[48px] bg-bg-tertiary/40 border-b border-border-primary">
          <Search size={16} className="text-text-tertiary" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands, map styles, loading samples..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none text-text-primary text-sm font-normal focus:outline-none placeholder-text-tertiary"
          />
          <kbd className="px-1.5 py-0.5 rounded-control text-[10px] font-mono bg-bg-active text-text-tertiary shrink-0 select-none">
            ESC
          </kbd>
        </div>

        {/* Actions List */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {filteredActions.length === 0 ? (
            <div className="text-center py-8 text-text-tertiary flex flex-col items-center gap-1.5">
              <Command size={22} className="opacity-30" />
              <p className="text-[11px] font-medium">No commands found matching "{search}"</p>
            </div>
          ) : (
            Object.entries(
              filteredActions.reduce((groups, action) => {
                if (!groups[action.category]) {
                  groups[action.category] = [];
                }
                groups[action.category].push(action);
                return groups;
              }, {} as Record<string, CommandAction[]>)
            ).map(([category, items]) => (
              <div key={category} className="flex flex-col gap-0.5 py-1">
                {/* Section Header */}
                <div className="px-3 py-1 text-[9px] font-bold text-text-tertiary uppercase tracking-[0.08em]">
                  {category}
                </div>
                {/* Section Items */}
                <div className="flex flex-col gap-0.5">
                  {items.map((action) => {
                    // Find global index in filtered list to highlight
                    const globalIdx = filteredActions.findIndex((a) => a.id === action.id);
                    const isFocused = globalIdx === selectedIndex;
                    const IconComp = action.icon;

                    return (
                      <div
                        key={action.id}
                        onClick={() => {
                          if (!action.disabled) {
                            action.run();
                            setIsOpen(false);
                          }
                        }}
                        className={cn(
                          'flex items-center justify-between px-3 h-[36px] rounded-control cursor-pointer transition-colors',
                          isFocused ? 'bg-bg-hover' : '',
                          action.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-hover/50'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <IconComp
                            size={16}
                            className={cn(isFocused ? 'text-accent' : 'text-text-secondary')}
                          />
                          <span
                            className={cn(
                              'text-xs truncate',
                              isFocused ? 'text-text-primary font-medium' : 'text-text-secondary'
                            )}
                          >
                            {action.title}
                          </span>
                        </div>
                        {action.shortcut && (
                          <div className="flex items-center gap-1.5 shrink-0 select-none">
                            <kbd className="px-1.5 py-0.5 rounded-control text-[9px] font-mono bg-bg-active text-text-tertiary select-none">
                              {action.shortcut}
                            </kbd>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Status Help Footer */}
        <div className="bg-bg-tertiary border-t border-border-primary px-5 py-2.5 text-[10px] text-text-tertiary flex justify-between select-none">
          <div className="flex items-center gap-2">
            <span>Use ↑↓ arrows to navigate</span>
            <span>•</span>
            <span>Enter to run</span>
          </div>
          <div>Press Cmd+K to toggle</div>
        </div>
      </div>
    </div>
  );
}
export default CommandPalette;
