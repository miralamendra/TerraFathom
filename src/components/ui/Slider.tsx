import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './utils';

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ className, min = 0, max = 100, step = 1, disabled, ...props }, ref) => {
    return (
      <div className={cn('relative flex items-center w-full py-2', className)}>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className={cn(
            'w-full h-1 bg-border-primary rounded-lg appearance-none cursor-pointer outline-none transition-all duration-150',
            // Thumb overrides
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-text-primary [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border-primary [&::-webkit-slider-thumb]:shadow-tight [&::-webkit-slider-thumb]:hover:bg-accent [&::-webkit-slider-thumb]:active:scale-105 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-150',
            '[&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-text-primary [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-border-primary [&::-moz-range-thumb]:shadow-tight [&::-moz-range-thumb]:hover:bg-accent [&::-moz-range-thumb]:active:scale-105 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:duration-150',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-border-focus',
            'disabled:opacity-50 disabled:pointer-events-none'
          )}
          {...props}
        />
      </div>
    );
  }
);

Slider.displayName = 'Slider';
