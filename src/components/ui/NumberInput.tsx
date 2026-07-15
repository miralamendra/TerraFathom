import { forwardRef, type InputHTMLAttributes, useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';
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
    
    // Keep local string state to allow entering decimal points, zeroes, or deleting
    const [inputValue, setInputValue] = useState<string>(
      value !== undefined ? String(value) : (defaultValue !== undefined ? String(defaultValue) : '')
    );

    // Sync input when prop value changes externally
    useEffect(() => {
      if (value !== undefined) {
        setInputValue((prev) => {
          const parsedPrev = parseFloat(prev);
          if (parsedPrev === value && prev !== '') {
            return prev;
          }
          return String(value);
        });
      }
    }, [value]);

    const handleIncrement = () => {
      if (disabled) return;
      const current = value !== undefined ? value : (parseFloat(inputValue) || 0);
      const next = Math.min(max, Number((current + step).toFixed(4)));
      setInputValue(String(next));
      onChange?.(next);
    };

    const handleDecrement = () => {
      if (disabled) return;
      const current = value !== undefined ? value : (parseFloat(inputValue) || 0);
      const next = Math.max(min, Number((current - step).toFixed(4)));
      setInputValue(String(next));
      onChange?.(next);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const valStr = e.target.value;
      setInputValue(valStr);

      const parsed = parseFloat(valStr);
      if (!isNaN(parsed)) {
        const clamped = Math.max(min, Math.min(max, parsed));
        onChange?.(clamped);
      } else if (valStr === '') {
        onChange?.(Math.max(min, 0));
      }
    };

    const handleBlur = () => {
      const parsed = parseFloat(inputValue);
      if (isNaN(parsed)) {
        const fallback = Math.max(min, Math.min(max, 0));
        setInputValue(String(fallback));
        onChange?.(fallback);
      } else {
        const clamped = Math.max(min, Math.min(max, parsed));
        setInputValue(String(clamped));
        onChange?.(clamped);
      }
    };

    return (
      <div className={cn('flex items-center w-full bg-bg-tertiary rounded-control border border-border-primary overflow-hidden focus-within:border-border-focus transition-all duration-150', className)}>
        {/* Decrement Button */}
        <button
          type="button"
          tabIndex={-1}
          onClick={handleDecrement}
          disabled={disabled}
          className="w-7 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:pointer-events-none transition-colors border-r cursor-pointer shrink-0"
          style={{ borderRightColor: 'rgba(255, 255, 255, 0.04)' }}
        >
          <Minus size={13} />
        </button>

        {/* Input Field */}
        <input
          ref={ref}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          className="w-full h-8 text-center bg-transparent text-text-primary text-xs font-mono placeholder-text-tertiary outline-none select-all min-w-0"
          {...props}
        />

        {/* Increment Button */}
        <button
          type="button"
          tabIndex={-1}
          onClick={handleIncrement}
          disabled={disabled}
          className="w-7 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:pointer-events-none transition-colors border-l cursor-pointer shrink-0"
          style={{ borderLeftColor: 'rgba(255, 255, 255, 0.04)' }}
        >
          <Plus size={13} />
        </button>
      </div>
    );
  }
);

NumberInput.displayName = 'NumberInput';
