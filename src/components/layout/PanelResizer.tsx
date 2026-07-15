import { cn } from '@/components/ui/utils';

export interface PanelResizerProps {
  orientation: 'horizontal' | 'vertical';
  onMouseDown: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function PanelResizer({ orientation, onMouseDown, className, style }: PanelResizerProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={style}
      className={cn(
        'group relative flex items-center justify-center bg-border-primary hover:bg-border-focus transition-colors duration-150 select-none z-30',
        orientation === 'horizontal'
          ? 'h-[2px] w-full cursor-row-resize py-0.5'
          : 'w-[2px] h-full cursor-col-resize px-0.5',
        className
      )}
    >
      {/* Expanded invisible drag target region for easier grabbing */}
      <div
        className={cn(
          'absolute pointer-events-none',
          orientation === 'horizontal' ? 'w-full h-2.5 -top-1 -bottom-1' : 'h-full w-2.5 -left-1 -right-1'
        )}
      />
    </div>
  );
}
