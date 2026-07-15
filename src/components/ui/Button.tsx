import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', type = 'button', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-control transition-colors duration-150',
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
            'h-8 px-2.5 text-xs': size === 'sm',
            'h-8 px-3.5 text-sm': size === 'md',
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

Button.displayName = 'Button';
