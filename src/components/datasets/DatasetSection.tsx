import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  FileText,
  Database,
  Trash2,
  Eye,
  EyeOff,
  CircleDot,
  Hexagon,
  Milestone,
  Flame,
  Map,
  Plus,
} from 'lucide-react';
import { type ProcessedDataset } from '@/types/dataset';
import { type LayerInstance, type LayerType } from '@/core/layers/base-layer';
import { LAYER_DEFINITIONS } from '@/core/layers/layer-registry';
import { useLayerStore } from '@/stores/layer-store';
import { useDataStore } from '@/stores/data-store';
import { useUIStore } from '@/stores/ui-store';
import { ColorPaletteStrip } from '@/components/ui/ColorPaletteStrip';
import { getPalette } from '@/core/colors/palettes';
import { toast } from 'sonner';
import { cn } from '@/components/ui/utils';

const ICON_MAP: Record<LayerType, React.ComponentType<any>> = {
  scatterplot: CircleDot,
  hexagon: Hexagon,
  arc: Milestone,
  heatmap: Flame,
  geojson: Map,
};

export interface DatasetSectionProps {
  dataset: ProcessedDataset;
  layers: LayerInstance[];
  defaultExpanded?: boolean;
}

export function DatasetSection({ dataset, layers, defaultExpanded = true }: DatasetSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedLayerId = useLayerStore((s) => s.selectedLayerId);
  const selectLayer = useLayerStore((s) => s.selectLayer);
  const removeLayer = useLayerStore((s) => s.removeLayer);
  const toggleLayerVisibility = useLayerStore((s) => s.toggleLayerVisibility);
  const addLayer = useLayerStore((s) => s.addLayer);
  const removeDataset = useDataStore((s) => s.removeDataset);
  const selectDataset = useDataStore((s) => s.selectDataset);
  const selectedDatasetId = useUIStore((s) => s.selectedDatasetId);

  const isDatasetSelected = selectedDatasetId === dataset.id;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleHeaderClick = () => {
    selectDataset(dataset.id);
    setExpanded(true);
  };

  const handleRemoveDataset = () => {
    removeDataset(dataset.id);
    toast.success(`Removed dataset: ${dataset.name}`);
    setMenuOpen(false);
  };

  const handleAddLayer = (type: LayerType) => {
    const def = LAYER_DEFINITIONS[type];
    if (!def) return;
    if (!def.validateDataset(dataset)) {
      toast.error(`${def.label} is not compatible with this dataset`);
      return;
    }
    addLayer(dataset.id, type, `${dataset.name} ${def.label}`);
    toast.success(`Added ${def.label} layer`);
  };

  const compatibleLayerTypes = (Object.values(LAYER_DEFINITIONS)).filter(
    (def) => def.validateDataset(dataset)
  );

  const FormatIcon = dataset.format === 'csv' ? FileText : Database;

  return (
    <section className={cn(
      'mb-3 last:mb-0 border rounded-lg overflow-hidden transition-all duration-300',
      isDatasetSelected 
        ? 'bg-bg-tertiary/10 border-border-primary' 
        : 'bg-bg-tertiary/5 border-border-primary/20 hover:border-border-primary/45'
    )}>
      <div className="group/dataset relative">
        <div
          onClick={handleHeaderClick}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="w-5 h-5 flex items-center justify-center shrink-0 hover:bg-bg-tertiary/50 rounded-md text-text-tertiary transition-colors z-10"
          >
            <ChevronDown
              size={14}
              className={cn('transition-transform duration-200 ease-in-out', !expanded && '-rotate-90')}
            />
          </button>
          
          <div className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0 border border-border-primary/20 shadow-inner z-10 transition-colors", isDatasetSelected ? "bg-bg-tertiary/40" : "bg-bg-tertiary/20 group-hover/dataset:bg-bg-tertiary/30")}>
            <FormatIcon size={13} className={cn("transition-colors", isDatasetSelected ? "text-text-primary" : "text-text-tertiary group-hover/dataset:text-text-secondary")} strokeWidth={1.5} />
          </div>
          
          <div className="flex flex-col min-w-0 flex-1 pl-0.5 z-10">
            <span className={cn("text-[13px] truncate leading-tight tracking-tight", isDatasetSelected ? "font-semibold" : "font-medium")} title={dataset.name}>
              {dataset.name}
            </span>
            <span className="text-[10px] text-text-tertiary mt-[1px] opacity-70 font-medium">Dataset</span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveDataset();
            }}
            className="w-6 h-6 rounded-md flex items-center justify-center text-text-tertiary hover:text-error hover:bg-error/10 opacity-0 group-hover/dataset:opacity-100 transition-all duration-200 cursor-pointer z-10"
            title="Remove dataset"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className={cn(
          "flex flex-col animate-fade-in relative border-t pb-2.5",
          isDatasetSelected ? "border-border-primary" : "border-border-primary/20"
        )}>
          {/* A sleek track guide line */}
          <div className="absolute left-[18px] top-3 bottom-5 w-px bg-border-primary/20 pointer-events-none" />

          {layers.length === 0 ? (
            <div className="pl-10 py-2.5 text-left">
              <span className="text-[11px] text-text-tertiary font-medium tracking-wide">No layers active</span>
            </div>
          ) : (
            <div className="flex flex-col pl-8 gap-1 pr-2 mt-2">
              {layers.map((layer) => {
                const Icon = ICON_MAP[layer.type] || Database;
                const isSelected = selectedLayerId === layer.id;
                return (
                  <div
                    key={layer.id}
                    onClick={() => {
                      selectLayer(layer.id);
                    }}
                    className={cn(
                      'group/layer flex items-center gap-2 px-2 py-1 cursor-pointer transition-all duration-300',
                      isSelected
                        ? 'text-text-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    )}
                  >
                    <Icon size={12} className={cn(
                      "shrink-0",
                      isSelected ? "text-text-primary" : "text-text-tertiary group-hover/layer:text-text-secondary"
                    )} strokeWidth={2} />

                    <span className={cn("text-[12.5px] truncate flex-1 leading-tight tracking-tight", isSelected ? "font-semibold" : "font-medium")} title={layer.name}>
                      {layer.name}
                    </span>

                    {layer.type === 'heatmap' && (
                      <ColorPaletteStrip
                        colors={getPalette(layer.config.colorPalette).colors.map(
                          ([r, g, b]) => `rgb(${r},${g},${b})`
                        )}
                        className="h-1 w-6 rounded-sm border-border-primary opacity-80"
                      />
                    )}

                    <div className="hidden group-hover/layer:flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLayerVisibility(layer.id);
                        }}
                        className={cn(
                          'w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors',
                          layer.config.visible ? 'text-text-primary hover:text-text-primary/80' : 'text-text-tertiary hover:text-text-secondary'
                        )}
                        title={layer.config.visible ? 'Hide layer' : 'Show layer'}
                      >
                        {layer.config.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeLayer(layer.id);
                          toast.success(`Removed layer: ${layer.name}`);
                        }}
                        className="w-5 h-5 rounded text-text-tertiary hover:text-error flex items-center justify-center"
                        title="Remove layer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {compatibleLayerTypes.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-2.5 pl-8 pr-2">
              {compatibleLayerTypes.map((def) => {
                return (
                  <button
                    key={def.type}
                    type="button"
                    onClick={() => handleAddLayer(def.type)}
                    className="inline-flex items-center gap-1.5 text-text-tertiary hover:text-text-primary transition-colors duration-300 text-[10px] font-medium tracking-wide cursor-pointer group/btn"
                    title={`Add ${def.label} layer`}
                  >
                    <Plus size={11} strokeWidth={2} className="group-hover/btn:text-text-primary transition-colors" />
                    <span>{def.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
export default DatasetSection;
