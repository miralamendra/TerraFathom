import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './utils';

export interface ColorSwatchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  color: string;
  active?: boolean;
  size?: 'sm' | 'md';
}

export const ColorSwatch = forwardRef<HTMLButtonElement, ColorSwatchProps>(
  ({ className, color, active = false, size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'relative rounded border shadow-sm transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary',
          {
            'w-5 h-5': size === 'sm',
            'w-7 h-7': size === 'md',
            'border-border-primary hover:scale-105': !active,
            'border-border-focus ring-1 ring-border-focus scale-105 z-10': active,
          },
          className
        )}
        style={{ backgroundColor: color }}
        title={color}
        {...props}
      />
    );
  }
);

ColorSwatch.displayName = 'ColorSwatch';
