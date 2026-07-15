import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { COLOR_PALETTES, getPalette, type PaletteOption } from '@/core/colors/palettes';
import { ColorPaletteStrip } from '@/components/ui';
import { cn } from '@/components/ui/utils';

export interface ColorPaletteSelectorProps {
  value: string;
  onChange: (paletteId: string) => void;
  className?: string;
}

export function ColorPaletteSelector({ value, onChange, className }: ColorPaletteSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activePalette = getPalette(value);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const formatColors = (colors: [number, number, number][]) => {
    return colors.map(([r, g, b]) => `rgb(${r},${g},${b})`);
  };

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };

  // Group palettes by type
  const sequentialPalettes = COLOR_PALETTES.filter((p) => p.type === 'sequential');
  const divergingPalettes = COLOR_PALETTES.filter((p) => p.type === 'diverging');
  const qualitativePalettes = COLOR_PALETTES.filter((p) => p.type === 'qualitative');

  const renderGroup = (title: string, items: PaletteOption[]) => (
    <div className="flex flex-col gap-1 py-1">
      <div className="px-2 py-0.5 text-xs font-semibold text-text-tertiary uppercase tracking-[0.12em] bg-bg-tertiary/40">
        {title}
      </div>
      {items.map((palette) => (
        <div
          key={palette.id}
          onClick={() => handleSelect(palette.id)}
          className={cn(
            'flex flex-col gap-1 p-2 rounded-md hover:bg-bg-hover transition-colors cursor-pointer',
            palette.id === value ? 'bg-bg-active' : ''
          )}
        >
          <div className="flex justify-between items-center text-[11px] font-medium text-text-primary">
            <span>{palette.name}</span>
          </div>
          <ColorPaletteStrip colors={formatColors(palette.colors)} active={palette.id === value} />
        </div>
      ))}
    </div>
  );

  return (
    <div ref={containerRef} className={cn('relative w-full select-none', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-8 flex items-center justify-between pl-2.5 pr-8 bg-bg-tertiary text-text-primary text-xs rounded-md border border-border-primary outline-none transition-all duration-150 cursor-pointer focus:border-border-focus focus:ring-1 focus:ring-border-focus"
      >
        <div className="flex items-center gap-2 text-left w-full mr-2 min-w-0">
          <span className="font-semibold text-xs truncate shrink-0 max-w-[80px]">{activePalette.name}</span>
          <ColorPaletteStrip colors={formatColors(activePalette.colors)} className="h-2 w-full border-0 rounded" />
        </div>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">
          <ChevronDown size={14} />
        </span>
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 max-h-[300px] overflow-y-auto bg-bg-elevated border border-border-primary rounded-md shadow-lg z-50 divide-y divide-border-primary divide-opacity-40 p-1">
          {renderGroup('Sequential Ramps', sequentialPalettes)}
          {renderGroup('Diverging Ramps', divergingPalettes)}
          {renderGroup('Qualitative Sets', qualitativePalettes)}
        </div>
      )}
    </div>
  );
}
export default ColorPaletteSelector;
