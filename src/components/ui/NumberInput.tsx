import { forwardRef, type InputHTMLAttributes } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from './utils';

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, defaultValue, min = -Infinity, max = Infinity, step = 1, onChange, disabled, ...props }, ref) => {
    
    const handleIncrement = () => {
      if (disabled) return;
      const current = value !== undefined ? value : (defaultValue ?? 0);
      const next = Math.min(max, current + step);
      onChange?.(next);
    };

    const handleDecrement = () => {
      if (disabled) return;
      const current = value !== undefined ? value : (defaultValue ?? 0);
      const next = Math.max(min, current - step);
      onChange?.(next);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        const clamped = Math.max(min, Math.min(max, val));
        onChange?.(clamped);
      }
    };

    return (
      <div className={cn('relative flex items-center w-full', className)}>
        <input
          ref={ref}
          type="number"
          value={value}
          defaultValue={defaultValue}
          min={min}
          max={max}
          step={step}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            'w-full pl-2.5 pr-8 py-1.5 bg-bg-secondary text-text-primary text-sm rounded border border-border-primary placeholder-text-tertiary outline-none transition-all duration-150 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
            'focus:border-border-focus focus:ring-1 focus:ring-border-focus',
            'disabled:opacity-50 disabled:pointer-events-none'
          )}
          {...props}
        />
        <div className="absolute right-1 flex flex-col gap-0.5">
          <button
            type="button"
            tabIndex={-1}
            onClick={handleIncrement}
            disabled={disabled}
            className="p-0.5 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none hover:bg-bg-hover rounded transition-colors"
          >
            <ChevronUp size={12} />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={handleDecrement}
            disabled={disabled}
            className="p-0.5 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none hover:bg-bg-hover rounded transition-colors"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>
    );
  }
);

NumberInput.displayName = 'NumberInput';
