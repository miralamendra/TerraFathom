import { type ReactNode } from 'react';
import { cn } from './utils';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export function Tooltip({ content, children, position = 'top', className }: TooltipProps) {
  return (
    <div className={cn('relative group inline-block', className)}>
      {children}
      <div
        className={cn(
          'absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150',
          'px-2 py-1 bg-bg-elevated text-text-primary text-xs rounded border border-border-primary whitespace-nowrap shadow-md z-50 pointer-events-none',
          {
            // Position: top
            'bottom-full left-1/2 -translate-x-1/2 mb-1.5': position === 'top',
            // Position: bottom
            'top-full left-1/2 -translate-x-1/2 mt-1.5': position === 'bottom',
            // Position: left
            'right-full top-1/2 -translate-y-1/2 mr-1.5': position === 'left',
            // Position: right
            'left-full top-1/2 -translate-y-1/2 ml-1.5': position === 'right',
          }
        )}
      >
        {content}
      </div>
    </div>
  );
}
