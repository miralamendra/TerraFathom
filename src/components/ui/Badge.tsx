import { type HTMLAttributes } from 'react';
import { cn } from './utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'info' | 'success' | 'warning' | 'error' | 'secondary';
  size?: 'sm' | 'md';
}

export function Badge({ className, variant = 'secondary', size = 'sm', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-medium rounded border select-none',
        // Variants
        {
          'bg-accent-muted text-accent border-accent/20': variant === 'info',
          'bg-success/15 text-success border-success/20': variant === 'success',
          'bg-warning/15 text-warning border-warning/20': variant === 'warning',
          'bg-error/15 text-error border-error/20': variant === 'error',
          'bg-bg-tertiary text-text-primary border-border-primary': variant === 'secondary',
        },
        // Sizes
        {
          'px-1.5 py-0.5 text-[10px]': size === 'sm',
          'px-2 py-0.5 text-[11px]': size === 'md',
        },
        className
      )}
      {...props}
    />
  );
}
