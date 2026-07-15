import { useState, useRef, useEffect } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Trash2,
  CircleDot,
  Hexagon,
  Milestone,
  Flame,
  Map,
  Sparkles,
  Palette,
  Pipette,
  type LucideIcon,
} from 'lucide-react';
import { type LayerInstance, type LayerType, type LayerConfig } from '@/core/layers/base-layer';
import { type ProcessedDataset } from '@/types/dataset';
import { useLayerStore } from '@/stores/layer-store';
import { useUIStore } from '@/stores/ui-store';
import { Slider, Switch, Select, NumberInput } from '@/components/ui';
import { RangeSlider } from '@/components/ui/RangeSlider';
import { ColorPaletteSelector } from '@/components/layers/ColorPaletteSelector';
import { COLOR_PALETTES, getPalette } from '@/core/colors/palettes';
import { cn } from '@/components/ui/utils';

const ICON_MAP: Record<LayerType, LucideIcon> = {
  scatterplot: CircleDot,
  hexagon: Hexagon,
  arc: Milestone,
  heatmap: Flame,
  geojson: Map,
};

export interface LayerEditorProps {
  layer: LayerInstance;
  dataset: ProcessedDataset;
}

export function LayerEditor({ layer, dataset }: LayerEditorProps) {
  const updateConfig = useLayerStore((s) => s.updateLayerConfig);
  const toggleVisibility = useLayerStore((s) => s.toggleLayerVisibility);
  const removeLayer = useLayerStore((s) => s.removeLayer);
  const selectLayer = useLayerStore((s) => s.selectLayer);
  const setSelectedLayerId = useUIStore((s) => s.setSelectedLayerId);
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen);
  const layers = useLayerStore((s) => s.layers);
  const datasetLayers = layers.filter((l) => l.datasetId === dataset.id);

  const Icon = ICON_MAP[layer.type] || Map;
  const { config } = layer;

  const numericFields = dataset.fields
    .filter((f) => f.type === 'integer' || f.type === 'real')
    .map((f) => ({ value: f.name, label: f.name }));
  const allFields = dataset.fields
    .filter((f) => f.name !== 'geometry')
    .map((f) => ({ value: f.name, label: f.name }));
  const fieldType = (name: string) => dataset.fields.find((f) => f.name === name)?.type;

  const hasColor = layer.type !== 'heatmap';
  const hasRadius = layer.type === 'scatterplot' || layer.type === 'hexagon' || layer.type === 'heatmap';
  const hasStroke = layer.type === 'geojson' || layer.type === 'arc';
  const hasExtrude = layer.type === 'hexagon' || layer.type === 'geojson';

  return (
    <div className="flex flex-col h-full text-xs select-none">
      {/* Header */}
      <div className="px-4 py-3.5 flex items-center gap-2.5 border-b border-border-primary shrink-0">
        <Icon size={16} className="text-text-primary shrink-0" />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold text-text-primary truncate" title={layer.name}>
            {layer.name}
          </span>
          <span className="text-[10px] text-text-tertiary uppercase tracking-[0.08em] font-semibold mt-0.5">
            {layer.type} · {dataset.name}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => toggleVisibility(layer.id)}
            className={cn(
              'w-7 h-7 rounded-control flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer',
              !config.visible && 'text-text-tertiary'
            )}
            title={config.visible ? 'Hide layer' : 'Show layer'}
          >
            {config.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            type="button"
            onClick={() => removeLayer(layer.id)}
            className="w-7 h-7 rounded-control flex items-center justify-center text-text-secondary hover:text-error hover:bg-bg-hover transition-colors cursor-pointer"
            title="Remove layer"
          >
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              selectLayer(null);
              setSelectedLayerId(null);
              setRightPanelOpen(false);
            }}
            className="w-7 h-7 rounded-control flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
            title="Close editor"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Dataset Layers Switcher Tab Bar */}
      {datasetLayers.length > 1 && (
        <div className="px-4 py-2.5 bg-bg-secondary border-b border-border-primary flex items-center gap-2 shrink-0 overflow-x-auto">
          <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider shrink-0">Layers</span>
          <div className="flex gap-1.5 overflow-x-auto">
            {datasetLayers.map((l) => {
              const isSelected = l.id === layer.id;
              const LayerIcon = ICON_MAP[l.type] || Map;
              return (
                <div
                  key={l.id}
                  className={cn(
                    'flex items-center rounded border transition-colors overflow-hidden shrink-0',
                    isSelected
                      ? 'bg-bg-active border-border-primary text-text-primary'
                      : 'bg-bg-tertiary border-border-primary text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectLayer(l.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap outline-none',
                      isSelected ? 'font-bold' : ''
                    )}
                  >
                    <LayerIcon size={11} className={isSelected ? 'text-text-primary' : 'text-text-tertiary'} />
                    <span>{l.name.replace(dataset.name, '').trim() || l.name}</span>
                  </button>
                  <div className="w-px h-3.5 bg-border-primary opacity-20" />
                  <button
                    type="button"
                    onClick={() => toggleVisibility(l.id)}
                    className="px-1.5 py-1 text-[11px] cursor-pointer hover:bg-bg-active/50 flex items-center justify-center outline-none"
                    title={l.config.visible ? 'Hide layer' : 'Show layer'}
                  >
                    {l.config.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        {/* Visual preset chips */}
        {layer.type === 'heatmap' && <HeatmapGradientEditor config={config} onChange={(c) => updateConfig(layer.id, c)} />}

        {/* Opacity */}
        <Section icon={<Pipette size={12} />} title="Opacity" className="z-40">
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
        </Section>

        {/* Blending Mode */}
        <Section icon={<Sparkles size={12} />} title="Blending Mode" className="z-35">
          <Select
            options={[
              { value: 'additive', label: 'Additive' },
              { value: 'normal', label: 'Normal' },
              { value: 'subtract', label: 'Subtract' },
            ]}
            value={config.blendMode || 'additive'}
            onChange={(e) => updateConfig(layer.id, { blendMode: e.target.value as any })}
          />
        </Section>

        {/* Color */}
        {hasColor && (
          <Section icon={<Palette size={12} />} title="Color" className="z-30">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-text-tertiary font-semibold uppercase tracking-wider">Color by Field</span>
                <Select
                  options={[{ value: '', label: 'None (Fixed Color)' }, ...(layer.type === 'geojson' ? allFields : numericFields)]}
                  value={config.colorField || ''}
                  onChange={(e) => {
                    const field = e.target.value;
                    if (field) {
                      const fType = fieldType(field);
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
                <div className="flex items-center gap-2 animate-fade-in">
                  <FixedColorSwatch
                    color={config.fillColor || [79, 124, 255]}
                    onChange={(c) => updateConfig(layer.id, { fillColor: c })}
                  />
                  <div className="flex-1">
                    <ColorPaletteSelector
                      value={config.colorPalette || 'curated'}
                      onChange={(paletteId) => {
                        const p = getPalette(paletteId);
                        updateConfig(layer.id, { colorPalette: paletteId, fillColor: p.colors[Math.floor(p.colors.length / 2)] });
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 animate-fade-in">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-text-tertiary font-semibold uppercase tracking-wider">Palette</span>
                    <ColorPaletteSelector
                      value={config.colorPalette || 'curated'}
                      onChange={(paletteId) => updateConfig(layer.id, { colorPalette: paletteId })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-text-tertiary font-semibold uppercase tracking-wider">Color Scale Mode</span>
                    <Select
                      options={[
                        { value: 'linear', label: 'Linear Scale' },
                        { value: 'quantize', label: 'Quantized buckets' },
                        { value: 'quantile', label: 'Quantile Scale' },
                        { value: 'logarithmic', label: 'Logarithmic Scale' },
                      ]}
                      value={config.colorScale || 'linear'}
                      onChange={(e) => updateConfig(layer.id, { colorScale: e.target.value as any })}
                    />
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Radius / Size */}
        {hasRadius && layer.type === 'scatterplot' && (
          <Section icon={<CircleDot size={12} />} title="Radius" className="z-20">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-text-tertiary font-semibold uppercase tracking-wider">Radius by Field</span>
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
                <div className="flex items-center gap-3 animate-fade-in">
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
              ) : (
                <div className="flex flex-col gap-2 animate-fade-in">
                  <span className="text-[10px] text-text-tertiary font-semibold uppercase tracking-wider">Range (px)</span>
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
                    <span className="text-text-tertiary text-xs font-mono">–</span>
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
            </div>
          </Section>
        )}

        {hasRadius && layer.type === 'hexagon' && (
          <Section icon={<Hexagon size={12} />} title="Cell size (m)" className="z-20">
            <div className="flex items-center gap-3">
              <Slider
                min={10}
                max={5000}
                step={10}
                value={config.hexagonRadius}
                onChange={(e) => updateConfig(layer.id, { hexagonRadius: parseInt(e.target.value, 10) })}
                className="flex-1"
              />
              <div className="w-20 shrink-0">
                <NumberInput
                  min={10}
                  max={5000}
                  step={10}
                  value={config.hexagonRadius}
                  onChange={(val) => updateConfig(layer.id, { hexagonRadius: val })}
                />
              </div>
            </div>
          </Section>
        )}

        {hasRadius && layer.type === 'heatmap' && (
          <>
            <Section icon={<Flame size={12} />} title="Blur radius (px)" className="z-20">
              <div className="flex items-center gap-3">
                <Slider
                  min={5}
                  max={100}
                  step={1}
                  value={config.radiusPixels}
                  onChange={(e) => updateConfig(layer.id, { radiusPixels: parseInt(e.target.value, 10) })}
                  className="flex-1"
                />
                <div className="w-20 shrink-0">
                  <NumberInput
                    min={5}
                    max={100}
                    step={1}
                    value={config.radiusPixels}
                    onChange={(val) => updateConfig(layer.id, { radiusPixels: val })}
                  />
                </div>
              </div>
            </Section>
            <Section icon={<Sparkles size={12} />} title="Density intensity" className="z-10">
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
            </Section>
          </>
        )}

        {/* Stroke */}
        {hasStroke && (
          <Section icon={<Sparkles size={12} />} title={layer.type === 'geojson' ? 'Stroke width (px)' : 'Arc width (px)'} className="z-10">
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
          </Section>
        )}

        {/* 3D Extrusion */}
        {hasExtrude && (
          <Section icon={<Map size={12} />} title="3D extrusion" className="z-10">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between h-7">
                <span className="text-xs text-text-secondary font-medium">Enable height</span>
                <Switch
                  checked={config.extruded}
                  onChange={(e) => updateConfig(layer.id, { extruded: e.target.checked })}
                />
              </div>
              {config.extruded && (
                <div className="flex flex-col gap-3 animate-fade-in">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-text-tertiary font-semibold uppercase tracking-wider">Height scale</span>
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
                  {layer.type === 'geojson' && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-text-tertiary font-semibold uppercase tracking-wider">Elevation field</span>
                      <Select
                        options={[{ value: '', label: 'Flat (none)' }, ...numericFields]}
                        value={config.geojsonElevationField || ''}
                        onChange={(e) => updateConfig(layer.id, { geojsonElevationField: e.target.value || undefined })}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ icon, title, children, className }: { icon: React.ReactNode; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5 relative", className)}>
      <div className="flex items-center gap-1.5 text-text-tertiary">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}



function FixedColorSwatch({ color, onChange }: { color: [number, number, number]; onChange: (c: [number, number, number]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const hex = '#' + color.map((x) => x.toString(16).padStart(2, '0')).join('');

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-control border border-border-primary hover:scale-105 active:scale-95 transition-transform cursor-pointer"
        style={{ backgroundColor: hex }}
        title={`Color ${hex.toUpperCase()}`}
      />
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-bg-elevated border border-border-primary rounded-[12px] shadow-floating p-3 w-56 animate-fade-in">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Quick palette</span>
            <div className="grid grid-cols-6 gap-1.5">
              {[
                [239, 68, 68],
                [249, 115, 22],
                [245, 158, 11],
                [234, 179, 8],
                [132, 204, 22],
                [34, 197, 94],
                [16, 185, 129],
                [20, 184, 166],
                [6, 182, 212],
                [14, 165, 233],
                [59, 130, 246],
                [99, 102, 241],
                [139, 92, 246],
                [168, 85, 247],
                [192, 38, 211],
                [236, 72, 153],
                [244, 63, 94],
                [100, 116, 139],
                [120, 113, 108],
                [156, 163, 175],
                [255, 255, 255],
                [209, 213, 219],
                [75, 85, 99],
                [15, 17, 23],
              ].map((rgb, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onChange(rgb as [number, number, number]);
                    setOpen(false);
                  }}
                  className="w-6 h-6 rounded border border-border-primary hover:scale-110 transition-transform cursor-pointer"
                  style={{ backgroundColor: `rgb(${rgb.join(',')})` }}
                />
              ))}
            </div>
            <div className="flex flex-col gap-1 mt-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Custom color</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={hex.toUpperCase()}
                  onChange={(e) => {
                    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(e.target.value);
                    if (m) onChange([parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]);
                  }}
                  className="flex-1 h-7 px-2 bg-bg-tertiary border border-border-primary rounded-control text-xs font-mono text-text-primary focus:border-border-focus focus:outline-none transition-colors"
                />
                <div className="relative w-7 h-7 rounded border border-border-primary overflow-hidden shrink-0 cursor-pointer">
                  <input
                    type="color"
                    value={hex}
                    onChange={(e) => {
                      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(e.target.value);
                      if (m) onChange([parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]);
                    }}
                    className="absolute -inset-1 w-[200%] h-[200%] cursor-pointer p-0 border-0 bg-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HeatmapGradientEditor({ config, onChange }: { config: LayerConfig; onChange: (c: Partial<LayerConfig>) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5 text-text-tertiary">
        <Flame size={12} />
        <span className="text-[10px] font-semibold uppercase tracking-wider">Heatmap gradient</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {COLOR_PALETTES.filter((p) => p.type !== 'qualitative').map((p) => {
          const active = (config.colorPalette || 'curated') === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange({ colorPalette: p.id })}
              className={cn(
                'flex flex-col gap-1 p-1.5 rounded-control border transition-colors text-left cursor-pointer',
                active ? 'border-border-focus bg-bg-active' : 'border-border-primary/50 bg-bg-tertiary/40 hover:bg-bg-hover'
              )}
            >
              <div
                className="h-3 w-full rounded-sm"
                style={{
                  background: `linear-gradient(to right, ${p.colors.map(([r, g, b]) => `rgb(${r},${g},${b})`).join(', ')})`,
                }}
              />
              <span className="text-[10px] text-text-secondary font-medium truncate">{p.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
export default LayerEditor;
