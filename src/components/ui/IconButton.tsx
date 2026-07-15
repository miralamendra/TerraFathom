import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './utils';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', size = 'md', type = 'button', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center rounded-control transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary',
          'disabled:opacity-50 disabled:pointer-events-none',
          // Variants
          {
            'bg-accent text-text-inverse hover:bg-accent-hover active:bg-accent-hover': variant === 'primary',
            'bg-bg-tertiary text-text-primary hover:bg-bg-hover active:bg-bg-active': variant === 'secondary',
            'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary active:bg-bg-active': variant === 'ghost',
            'bg-error text-text-inverse hover:bg-error/80 active:bg-error/70': variant === 'danger',
          },
          // Sizes
          {
            'p-1 w-8 h-8 text-xs': size === 'sm',
            'p-1.5 w-8 h-8 text-sm': size === 'md',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
