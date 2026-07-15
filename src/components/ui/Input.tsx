import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'w-full h-8 px-2.5 bg-bg-tertiary text-text-primary text-sm rounded-control border border-border-primary placeholder-text-tertiary outline-none transition-all duration-150',
          'focus:border-border-focus focus:ring-0',
          'disabled:opacity-50 disabled:pointer-events-none',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
