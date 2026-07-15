import { useLayerStore } from '@/stores/layer-store';
import { useDataStore } from '@/stores/data-store';
import { useUIStore } from '@/stores/ui-store';
import { getPalette } from '@/core/colors/palettes';
import { getOrdinalScale } from '@/core/colors/scales';

export function MapLegend() {
  const selectedLayerId = useLayerStore((s) => s.selectedLayerId);
  const layers = useLayerStore((s) => s.layers);
  const datasets = useDataStore((s) => s.datasets);

  const bottomOpen = useUIStore((s) => s.bottomDrawerOpen);
  const bottomHeight = useUIStore((s) => s.bottomDrawerHeight);

  // Find active layer to display: selected one, or the first visible one
  const activeLayer = selectedLayerId 
    ? layers.find((l) => l.id === selectedLayerId)
    : layers.find((l) => l.config.visible);

  if (!activeLayer || !activeLayer.config.visible) {
    return null;
  }

  const { config, type, name, datasetId } = activeLayer;
  const dataset = datasets[datasetId];

  // Render helper for numerical gradients
  const renderNumericGradient = (field: string, paletteId: string, min: number | string | null, max: number | string | null) => {
    const palette = getPalette(paletteId);
    const gradientColors = palette.colors.map(([r, g, b]) => `rgb(${r},${g},${b})`).join(', ');
    const displayMin = typeof min === 'number' ? min.toLocaleString(undefined, { maximumFractionDigits: 2 }) : min || '0';
    const displayMax = typeof max === 'number' ? max.toLocaleString(undefined, { maximumFractionDigits: 2 }) : max || '100';

    return (
      <div className="flex flex-col gap-1.5 mt-0.5">
        <div className="text-[11px] text-text-secondary truncate">
          Color: <span className="font-semibold text-text-primary">{field}</span>
        </div>
        {/* Color Gradient Strip */}
        <div
          className="h-2 w-full rounded-[3px] border border-border-primary/50"
          style={{ background: `linear-gradient(to right, ${gradientColors})` }}
        />
        {/* Labels */}
        <div className="flex justify-between text-[10px] text-text-tertiary font-mono">
          <span>{displayMin}</span>
          <span>{displayMax}</span>
        </div>
      </div>
    );
  };

  // Render helper for categorical legend swatches
  const renderCategoricalSwatches = (field: string, paletteId: string, uniqueValues: (string | number | boolean | null)[]) => {
    const palette = getPalette(paletteId).colors;
    const ordinalScale = getOrdinalScale(uniqueValues, palette);
    const maxShow = 5;
    const displayValues = uniqueValues.slice(0, maxShow);
    const remainingCount = uniqueValues.length - maxShow;

    return (
      <div className="flex flex-col gap-1.5 mt-0.5">
        <div className="text-[11px] text-text-secondary truncate">
          Color: <span className="font-semibold text-text-primary">{field}</span>
        </div>
        <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
          {displayValues.map((val) => {
            const rgb = ordinalScale(val);
            const rgbStr = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
            const displayLabel = val === null || val === undefined ? 'Null/Empty' : String(val);

            return (
              <div key={displayLabel} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0 border border-border-primary/50" style={{ backgroundColor: rgbStr }} />
                <span className="text-[11px] text-text-secondary truncate" title={displayLabel}>
                  {displayLabel}
                </span>
              </div>
            );
          })}
          {remainingCount > 0 && (
            <div className="text-[10px] text-text-tertiary pl-4">
              + {remainingCount} more categories
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render helper for Arc connection details
  const renderArcLegend = () => {
    return (
      <div className="flex flex-col gap-1.5 mt-0.5">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-2 rounded bg-rose-500 border border-black/10 shrink-0" />
          <span className="text-xs text-text-secondary">Source (Pickup)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-2 rounded bg-emerald-500 border border-black/10 shrink-0" />
          <span className="text-xs text-text-secondary">Target (Dropoff)</span>
        </div>
      </div>
    );
  };

  // Determine what legend content is needed
  let legendContent = null;

  if (type === 'arc') {
    legendContent = renderArcLegend();
  } else if (type === 'heatmap') {
    // Spatial density heatmap
    legendContent = renderNumericGradient(
      config.colorField || 'Density count',
      config.colorPalette || 'thermal',
      'Low',
      'High'
    );
  } else if (type === 'hexagon') {
    if (config.colorMode === 'mapped' && config.colorField && dataset) {
      const stats = dataset.fields.find((f) => f.name === config.colorField);
      legendContent = renderNumericGradient(
        config.colorField,
        config.colorPalette || 'magma',
        stats?.min ?? '0',
        stats?.max ?? '100'
      );
    } else {
      legendContent = renderNumericGradient(
        'Points Density',
        config.colorPalette || 'magma',
        'Low Count',
        'High Count'
      );
    }
  } else if ((type === 'scatterplot' || type === 'geojson') && dataset) {
    if (config.colorMode === 'mapped' && config.colorField) {
      const stats = dataset.fields.find((f) => f.name === config.colorField);
      if (stats) {
        if (stats.type === 'string' || stats.type === 'boolean') {
          legendContent = renderCategoricalSwatches(
            config.colorField,
            config.colorPalette || 'bold',
            stats.uniqueValues
          );
        } else {
          legendContent = renderNumericGradient(
            config.colorField,
            config.colorPalette || 'viridis',
            stats.min,
            stats.max
          );
        }
      }
    }
  }

  // Only display legend panel if there is active visualization contents to show
  if (!legendContent) {
    return null;
  }

  const bottomOffset = bottomOpen ? bottomHeight + 16 : 16;

  return (
    <div
      className="absolute left-4 z-30 w-[240px] p-3 bg-bg-elevated border border-border-primary rounded-[6px] shadow-floating select-none font-sans text-[11px] animate-fade-in flex flex-col gap-2 transition-all duration-75"
      style={{ bottom: bottomOffset }}
    >
      {/* Title */}
      <div>
        <h4 className="font-semibold text-text-primary text-[11px] truncate leading-normal" title={name}>
          {name}
        </h4>
        <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">
          {type} Legend
        </span>
      </div>

      <div className="h-px bg-border-secondary" />

      {/* Legend values */}
      <div className="flex flex-col gap-2 text-[11px]">
        {legendContent}
      </div>
    </div>
  );
}
export default MapLegend;
