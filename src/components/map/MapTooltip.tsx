import { useMapTooltip } from '@/hooks/use-map-tooltip';
import { useLayerStore } from '@/stores/layer-store';
import { useDataStore } from '@/stores/data-store';

export function MapTooltip() {
  const hoverInfo = useMapTooltip((s) => s.hoverInfo);
  const layers = useLayerStore((s) => s.layers);
  const datasets = useDataStore((s) => s.datasets);

  if (!hoverInfo || !hoverInfo.object) {
    return null;
  }

  const { x, y, object, layer } = hoverInfo;

  // Determine Layer / Dataset name
  const layerId = layer?.props?.id || layer?.id;
  const activeLayer = layers.find((l) => l.id === layerId);
  const dataset = activeLayer ? datasets[activeLayer.datasetId] : null;

  // Filters out geometry, latitude, longitude columns to keep tooltip dense
  const skipRegex = /^(geometry|lat|lng|latitude|longitude|coords|coordinates|position|_geom)$/i;

  const entries = Object.entries(object).filter(
    ([key]) => !skipRegex.test(key) && typeof object[key] !== 'object'
  );

  // Format values nicely
  const formatValue = (key: string, value: unknown) => {
    if (value === null || value === undefined) {
      return <span className="text-text-tertiary">null</span>;
    }

    if (typeof value === 'number') {
      return (
        <span className="font-mono text-accent">
          {Number.isInteger(value)
            ? value.toLocaleString()
            : value.toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </span>
      );
    }

    if (typeof value === 'boolean') {
      return <span className="font-mono text-accent">{value ? 'true' : 'false'}</span>;
    }

    const strVal = String(value);

    // Date heuristic check
    if (
      (key.toLowerCase().includes('time') || key.toLowerCase().includes('date')) &&
      !isNaN(Date.parse(strVal))
    ) {
      try {
        const date = new Date(strVal);
        return <span className="text-success">{date.toLocaleString()}</span>;
      } catch {
        // Fallback to text
      }
    }

    return <span className="text-text-secondary truncate block max-w-[150px]">{strVal}</span>;
  };

  if (entries.length === 0) {
    return null;
  }

  // Viewport edge bounding logic
  const tooltipWidth = 240;
  const tooltipHeight = 180;
  const isRightSide = x > window.innerWidth - tooltipWidth - 20;
  const isBottomSide = y > window.innerHeight - tooltipHeight - 20;

  const stylePosition = {
    left: isRightSide ? `${x - tooltipWidth - 12}px` : `${x + 12}px`,
    top: isBottomSide ? `${y - tooltipHeight - 12}px` : `${y + 12}px`,
    width: `${tooltipWidth}px`,
  };

  return (
    <div
      style={stylePosition}
      className="absolute z-50 pointer-events-none bg-bg-secondary/75 border border-border-primary/60 rounded-md shadow-floating p-2.5 backdrop-blur-xl text-xs font-sans flex flex-col gap-1.5 animate-fade-in"
    >
      {/* Tooltip Header */}
      <div className="flex flex-col border-b border-border-primary/50 pb-1 mb-0.5">
        <span className="font-semibold text-text-primary text-sm truncate">
          {activeLayer?.name || 'Map Feature'}
        </span>
        {dataset && (
          <span className="text-xs text-text-tertiary uppercase tracking-wider font-semibold">
            {dataset.name}
          </span>
        )}
      </div>

      {/* Attributes List */}
      <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto pr-0.5">
        {entries.map(([key, val]) => (
          <div key={key} className="flex justify-between items-center gap-2">
            <span className="text-text-tertiary truncate font-medium max-w-[90px]" title={key}>
              {key}
            </span>
            <div className="text-right shrink-0 text-xs">{formatValue(key, val)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
export default MapTooltip;
