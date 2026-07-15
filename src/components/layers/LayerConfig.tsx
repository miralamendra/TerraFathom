import { useLayerStore } from '@/stores/layer-store';
import { useDataStore } from '@/stores/data-store';
import { Slider, Switch, Select, NumberInput } from '@/components/ui';
import { RangeSlider } from '@/components/ui/RangeSlider';
import { Collapsible } from '@/components/ui/Collapsible';
import { ColorPaletteSelector } from './ColorPaletteSelector';
import { 
  CircleDot, 
  Hexagon, 
  Milestone, 
  Flame, 
  Map, 
  Trash2, 
  Eye, 
  EyeOff, 
  Layers
} from 'lucide-react';

export function LayerConfig() {
  const selectedLayerId = useLayerStore((s) => s.selectedLayerId);
  const layers = useLayerStore((s) => s.layers);
  const updateConfig = useLayerStore((s) => s.updateLayerConfig);
  const toggleVisibility = useLayerStore((s) => s.toggleLayerVisibility);
  const removeLayer = useLayerStore((s) => s.removeLayer);
  const datasets = useDataStore((s) => s.datasets);

  const layer = selectedLayerId ? layers.find((l) => l.id === selectedLayerId) : null;
  const dataset = layer ? datasets[layer.datasetId] : null;

  if (!layer) {
    return (
      <div className="text-center text-text-tertiary p-6 text-xs">
        No layer selected. Select a layer from the left panel to configure its properties.
      </div>
    );
  }

  const { config } = layer;

  const numericFields = dataset
    ? dataset.fields
        .filter((f) => f.type === 'integer' || f.type === 'real')
        .map((f) => ({ value: f.name, label: f.name }))
    : [];

  const allFields = dataset
    ? dataset.fields
        .filter((f) => f.name !== 'geometry')
        .map((f) => ({ value: f.name, label: f.name }))
    : [];

  const getFieldType = (fieldName: string) => {
    return dataset?.fields.find((f) => f.name === fieldName)?.type;
  };

  const getLayerIcon = (type: string) => {
    switch (type) {
      case 'scatterplot': return CircleDot;
      case 'hexagon': return Hexagon;
      case 'arc': return Milestone;
      case 'heatmap': return Flame;
      case 'geojson': return Map;
      default: return Layers;
    }
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  };

  const hexToRgb = (hex: string): [number, number, number] | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : null;
  };

  const IconComponent = getLayerIcon(layer.type);

  const hasColorSettings = layer.type !== 'heatmap';
  const hasRadiusSettings = ['scatterplot', 'hexagon', 'heatmap'].includes(layer.type);
  const hasStrokeSettings = ['geojson', 'arc'].includes(layer.type);
  const hasElevationSettings = ['hexagon', 'geojson'].includes(layer.type);

  return (
    <div className="flex flex-col gap-4 font-sans text-xs">
      
      {/* ──────────────────────────────────────────────────────── */}
      {/* LAYER HEADER: 48px Height, Compact Bannerless Layout */}
      {/* ──────────────────────────────────────────────────────── */}
      <div className="h-12 flex items-center justify-between px-2.5 bg-bg-secondary border border-border-primary rounded-sm select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <IconComponent size={16} className="text-text-secondary shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-[12px] font-semibold text-text-primary truncate" title={layer.name}>
              {layer.name}
            </span>
            <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">
              {layer.type}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Visibility toggle switch */}
          <button
            type="button"
            onClick={() => toggleVisibility(layer.id)}
            title={config.visible ? 'Hide Layer' : 'Show Layer'}
            className="p-1 text-text-secondary hover:text-text-primary rounded hover:bg-bg-hover transition-colors cursor-pointer"
          >
            {config.visible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          
          {/* Delete Layer button */}
          <button
            type="button"
            onClick={() => removeLayer(layer.id)}
            title="Delete Layer"
            className="p-1 text-text-secondary hover:text-error rounded hover:bg-bg-hover transition-colors cursor-pointer"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Layer metadata summary */}
      <div className="py-3 border-b border-border-secondary">
        <Collapsible title="Layer Information" defaultOpen={false}>
          <div className="flex flex-col gap-2 pt-1 text-text-secondary">
            <div className="flex justify-between">
              <span className="text-text-tertiary font-medium">Dataset</span>
              <span className="truncate max-w-[150px] font-medium text-text-primary">{dataset?.name || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary font-medium">Rows Count</span>
              <span className="font-medium text-text-primary font-mono">{(dataset?.rowCount || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary font-medium">Data Format</span>
              <span className="uppercase text-[9px] font-semibold tracking-wider bg-bg-tertiary px-1 py-0.5 rounded border border-border-primary text-text-primary">
                {dataset?.format || 'N/A'}
              </span>
            </div>
          </div>
        </Collapsible>
      </div>

      {/* Opacity row - globally available */}
      <div className="py-3 border-b border-border-secondary">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary">Opacity (%)</label>
          <div className="flex items-center gap-3">
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={config.opacity}
              onChange={(e) => updateConfig(layer.id, { opacity: parseFloat(e.target.value) })}
              className="flex-1"
            />
            <div className="w-20 shrink-0">
              <NumberInput
                min={0}
                max={1}
                step={0.05}
                value={config.opacity}
                onChange={(val) => updateConfig(layer.id, { opacity: val })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Layer Blending Mode - globally available */}
      <div className="py-3 border-b border-border-secondary">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary">Layer Blending</label>
          <Select
            options={[
              { value: 'additive', label: 'Additive' },
              { value: 'normal', label: 'Normal' },
              { value: 'subtract', label: 'Subtract' },
            ]}
            value={config.blendMode || 'additive'}
            onChange={(e) => updateConfig(layer.id, { blendMode: e.target.value as any })}
          />
        </div>
      </div>


      {/* Color settings section */}
      {hasColorSettings && (
        <div className="py-3 border-b border-border-secondary">
          <Collapsible title="Color Fill" defaultOpen={true}>
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-text-tertiary font-medium">Color by Field</label>
                <Select
                  options={[{ value: '', label: 'None (Fixed Color)' }, ...(layer.type === 'geojson' ? allFields : numericFields)]}
                  value={config.colorField || ''}
                  onChange={(e) => {
                    const field = e.target.value;
                    if (field) {
                      const fType = getFieldType(field);
                      updateConfig(layer.id, {
                        colorField: field,
                        colorMode: 'mapped',
                        colorScale: fType === 'string' || fType === 'boolean' ? 'ordinal' : 'linear',
                      });
                    } else {
                      updateConfig(layer.id, {
                        colorField: undefined,
                        colorMode: 'fixed',
                      });
                    }
                  }}
                />
              </div>

              {config.colorMode === 'fixed' || !config.colorField ? (
                <div className="flex flex-col gap-1.5 animate-fade-in">
                  <label className="text-[11px] text-text-tertiary font-medium">Fill Color</label>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-8 h-8 rounded-sm border border-border-primary shrink-0 transition-transform hover:scale-105"
                      style={{ backgroundColor: rgbToHex(config.fillColor?.[0] || 79, config.fillColor?.[1] || 124, config.fillColor?.[2] || 255) }}
                    />
                    <div className="w-24">
                      <input
                        type="text"
                        value={rgbToHex(config.fillColor?.[0] || 79, config.fillColor?.[1] || 124, config.fillColor?.[2] || 255).toUpperCase()}
                        onChange={(e) => {
                          const rgb = hexToRgb(e.target.value);
                          if (rgb) updateConfig(layer.id, { fillColor: rgb });
                        }}
                        placeholder="#4F7CFF"
                        className="w-full h-8 px-2.5 bg-bg-tertiary text-text-primary text-xs font-mono rounded-sm border border-border-primary placeholder-text-tertiary outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <ColorPaletteSelector
                        value={config.colorPalette || 'curated'}
                        onChange={(paletteId) => updateConfig(layer.id, { colorPalette: paletteId })}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 animate-fade-in">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-text-tertiary font-medium">Color Palette</label>
                    <ColorPaletteSelector
                      value={config.colorPalette || 'curated'}
                      onChange={(paletteId) => updateConfig(layer.id, { colorPalette: paletteId })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-text-tertiary font-medium">Color Scale Mode</label>
                    <Select
                      options={[
                        { value: 'linear', label: 'Linear Scale' },
                        { value: 'quantize', label: 'Quantized buckets' },
                      ]}
                      value={config.colorScale || 'linear'}
                      onChange={(e) => updateConfig(layer.id, { colorScale: e.target.value as any })}
                    />
                  </div>
                </div>
              )}
            </div>
          </Collapsible>
        </div>
      )}

      {/* Radius & Size section */}
      {hasRadiusSettings && (
        <div className="py-3 border-b border-border-secondary">
          <Collapsible title="Radius & Size" defaultOpen={true}>
            <div className="flex flex-col gap-3 pt-1">
              {layer.type === 'scatterplot' ? (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-text-tertiary font-medium">Radius by Field</label>
                    <Select
                      options={[{ value: '', label: 'None (Fixed Size)' }, ...numericFields]}
                      value={config.radiusField || ''}
                      onChange={(e) => {
                        const field = e.target.value;
                        if (field) {
                          updateConfig(layer.id, {
                            radiusField: field,
                            radiusMode: 'mapped',
                          });
                        } else {
                          updateConfig(layer.id, {
                            radiusField: undefined,
                            radiusMode: 'fixed',
                          });
                        }
                      }}
                    />
                  </div>

                  {config.radiusMode === 'fixed' || !config.radiusField ? (
                    <div className="flex flex-col gap-1.5 animate-fade-in">
                      <label className="text-[11px] text-text-tertiary font-medium">Fixed Radius (px)</label>
                      <div className="flex items-center gap-3">
                        <Slider
                          min={1}
                          max={120}
                          step={1}
                          value={config.radius}
                          onChange={(e) => updateConfig(layer.id, { radius: parseInt(e.target.value, 10) })}
                          className="flex-1"
                        />
                        <div className="w-20 shrink-0">
                          <NumberInput
                            min={1}
                            max={120}
                            step={1}
                            value={config.radius}
                            onChange={(val) => updateConfig(layer.id, { radius: val })}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 animate-fade-in">
                      <label className="text-[11px] text-text-tertiary font-medium">Size Range (px)</label>
                      <RangeSlider
                        min={1}
                        max={120}
                        step={1}
                        value={config.radiusRange}
                        onChange={(val) => updateConfig(layer.id, { radiusRange: val })}
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1">
                          <NumberInput
                            min={1}
                            max={120}
                            step={1}
                            value={config.radiusRange[0]}
                            onChange={(val) => updateConfig(layer.id, { radiusRange: [val, config.radiusRange[1]] })}
                          />
                        </div>
                        <span className="text-text-tertiary font-mono">-</span>
                        <div className="flex-1">
                          <NumberInput
                            min={1}
                            max={120}
                            step={1}
                            value={config.radiusRange[1]}
                            onChange={(val) => updateConfig(layer.id, { radiusRange: [config.radiusRange[0], val] })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-text-tertiary font-medium">
                    {layer.type === 'hexagon' ? 'Hexagon Grid Size (m)' : 'Blur Radius (px)'}
                  </label>
                  <div className="flex items-center gap-3">
                    <Slider
                      min={layer.type === 'hexagon' ? 10 : 5}
                      max={layer.type === 'hexagon' ? 5000 : 100}
                      step={layer.type === 'hexagon' ? 10 : 1}
                      value={layer.type === 'hexagon' ? config.hexagonRadius : config.radiusPixels}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (layer.type === 'hexagon') updateConfig(layer.id, { hexagonRadius: val });
                        else updateConfig(layer.id, { radiusPixels: val });
                      }}
                      className="flex-1"
                    />
                    <div className="w-20 shrink-0">
                      <NumberInput
                        min={layer.type === 'hexagon' ? 10 : 5}
                        max={layer.type === 'hexagon' ? 5000 : 100}
                        step={layer.type === 'hexagon' ? 10 : 1}
                        value={layer.type === 'hexagon' ? config.hexagonRadius : config.radiusPixels}
                        onChange={(val) => {
                          if (layer.type === 'hexagon') updateConfig(layer.id, { hexagonRadius: val });
                          else updateConfig(layer.id, { radiusPixels: val });
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Heatmap Density Intensity */}
              {layer.type === 'heatmap' && (
                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="text-[11px] text-text-tertiary font-medium">Density Intensity</label>
                  <div className="flex items-center gap-3">
                    <Slider
                      min={0.1}
                      max={10}
                      step={0.1}
                      value={config.intensity}
                      onChange={(e) => updateConfig(layer.id, { intensity: parseFloat(e.target.value) })}
                      className="flex-1"
                    />
                    <div className="w-20 shrink-0">
                      <NumberInput
                        min={0.1}
                        max={10}
                        step={0.1}
                        value={config.intensity}
                        onChange={(val) => updateConfig(layer.id, { intensity: val })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Collapsible>
        </div>
      )}

      {/* Stroke Settings for Arc and GeoJSON */}
      {hasStrokeSettings && (
        <div className="py-3 border-b border-border-secondary">
          <Collapsible title="Stroke Settings" defaultOpen={true}>
            <div className="flex flex-col gap-1.5 pt-1">
              <label className="text-[11px] text-text-tertiary font-medium">
                {layer.type === 'geojson' ? 'Outline Stroke Width (px)' : 'Arc Line Width (px)'}
              </label>
              <div className="flex items-center gap-3">
                <Slider
                  min={layer.type === 'geojson' ? 0 : 1}
                  max={layer.type === 'geojson' ? 10 : 15}
                  step={0.5}
                  value={layer.type === 'geojson' ? config.strokeWidth : config.arcWidth}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (layer.type === 'geojson') updateConfig(layer.id, { strokeWidth: val });
                    else updateConfig(layer.id, { arcWidth: val });
                  }}
                  className="flex-1"
                />
                <div className="w-20 shrink-0">
                  <NumberInput
                    min={layer.type === 'geojson' ? 0 : 1}
                    max={layer.type === 'geojson' ? 10 : 15}
                    step={0.5}
                    value={layer.type === 'geojson' ? config.strokeWidth : config.arcWidth}
                    onChange={(val) => {
                      if (layer.type === 'geojson') updateConfig(layer.id, { strokeWidth: val });
                      else updateConfig(layer.id, { arcWidth: val });
                    }}
                  />
                </div>
              </div>
            </div>
          </Collapsible>
        </div>
      )}

      {/* Extrusion / 3D Heights settings */}
      {hasElevationSettings && (
        <div className="py-3 border-b border-border-secondary">
          <Collapsible title="3D Extrusion Heights" defaultOpen={false}>
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex items-center justify-between h-8">
                <label className="text-xs font-medium text-text-secondary cursor-pointer" htmlFor="toggle-extrude-prop">
                  Enable 3D Heights
                </label>
                <Switch
                  id="toggle-extrude-prop"
                  checked={config.extruded}
                  onChange={(e) => updateConfig(layer.id, { extruded: e.target.checked })}
                />
              </div>

              {config.extruded && (
                <div className="flex flex-col gap-3 animate-fade-in">
                  {layer.type === 'geojson' && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-text-tertiary font-medium">Elevation Field Mapping</label>
                      <Select
                        options={[{ value: '', label: 'Flat (None)' }, ...numericFields]}
                        value={config.geojsonElevationField || ''}
                        onChange={(e) => updateConfig(layer.id, { geojsonElevationField: e.target.value || undefined })}
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-text-tertiary font-medium">Height Scale Multiplier</label>
                    <div className="flex items-center gap-3">
                      <Slider
                        min={1}
                        max={200}
                        step={1}
                        value={config.elevationScale}
                        onChange={(e) => updateConfig(layer.id, { elevationScale: parseInt(e.target.value, 10) })}
                        className="flex-1"
                      />
                      <div className="w-20 shrink-0">
                        <NumberInput
                          min={1}
                          max={200}
                          step={1}
                          value={config.elevationScale}
                          onChange={(val) => updateConfig(layer.id, { elevationScale: val })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Collapsible>
        </div>
      )}

      {/* Interaction block */}
      <div className="py-3 border-b border-border-secondary">
        <Collapsible title="Interaction" defaultOpen={false}>
          <div className="flex items-center justify-between h-8 pt-1">
            <span className="text-xs text-text-secondary">Enable Map Tooltips</span>
            <Switch
              id="toggle-tooltips-prop"
              checked={true}
              disabled
            />
          </div>
        </Collapsible>
      </div>
    </div>
  );
}
export default LayerConfig;
