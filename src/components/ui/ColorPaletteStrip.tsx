import { cn } from './utils';

export interface ColorPaletteStripProps {
  colors: string[];
  className?: string;
  active?: boolean;
  onClick?: () => void;
}

export function ColorPaletteStrip({ colors, className, active = false, onClick }: ColorPaletteStripProps) {
  const isClickable = !!onClick;
  
  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={cn(
        'flex h-4 w-full rounded overflow-hidden border transition-all duration-150',
        isClickable ? 'cursor-pointer hover:opacity-90' : '',
        active ? 'border-border-focus ring-1 ring-border-focus scale-[1.01]' : 'border-border-primary',
        className
      )}
    >
      {colors.map((color, index) => (
        <div
          key={`${color}-${index}`}
          className="flex-1 h-full"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}
