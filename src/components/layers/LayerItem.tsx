import { Eye, EyeOff, Trash2, ArrowUp, ArrowDown, CircleDot, Hexagon, GitCommit, Flame, Layers } from 'lucide-react';
import { type LayerInstance } from '@/core/layers/base-layer';
import { cn } from '@/components/ui/utils';

const ICON_MAP = {
  scatterplot: CircleDot,
  hexagon: Hexagon,
  arc: GitCommit,
  heatmap: Flame,
  geojson: Layers,
};

export interface LayerItemProps {
  layer: LayerInstance;
  selected: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function LayerItem({
  layer,
  selected,
  onSelect,
  onToggleVisible,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: LayerItemProps) {
  const Icon = ICON_MAP[layer.type] || Layers;

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group flex items-center justify-between h-[34px] transition-all duration-150 cursor-pointer select-none pl-2.5 pr-1 border-b border-border-secondary/35 last:border-b-0',
        selected
          ? 'bg-bg-active text-text-primary'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Toggle Visible */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisible();
          }}
          title={layer.config.visible ? 'Hide Layer' : 'Show Layer'}
          className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center transition-colors text-text-tertiary hover:text-text-primary hover:bg-bg-hover cursor-pointer shrink-0',
            layer.config.visible ? 'text-accent opacity-90' : 'opacity-40 hover:opacity-100'
          )}
        >
          {layer.config.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>

        {/* Icon & Label */}
        <Icon size={14} className="text-text-secondary shrink-0" />
        <div className="flex flex-col min-w-0 leading-none">
          <span className="text-xs font-semibold text-text-primary truncate max-w-[130px] leading-tight" title={layer.name}>
            {layer.name}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Reordering Up/Down controls */}
        {onMoveUp && (
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            title="Move Layer Up"
            className="w-6 h-6 rounded-full flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <ArrowUp size={14} />
          </button>
        )}
        {onMoveDown && (
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            title="Move Layer Down"
            className="w-6 h-6 rounded-full flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <ArrowDown size={14} />
          </button>
        )}

        {/* Delete button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove Layer"
          className="w-6 h-6 rounded-full flex items-center justify-center text-text-tertiary hover:text-error hover:bg-bg-hover cursor-pointer"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
export default LayerItem;
