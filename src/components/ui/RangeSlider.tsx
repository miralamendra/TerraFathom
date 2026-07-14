import { useState, useEffect, useRef } from 'react';
import { cn } from './utils';

export interface RangeSliderProps {
  min?: number;
  max?: number;
  step?: number;
  value?: [number, number];
  defaultValue?: [number, number];
  onChange?: (value: [number, number]) => void;
  className?: string;
  disabled?: boolean;
}

export function RangeSlider({
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue = [20, 80],
  onChange,
  className,
  disabled = false,
}: RangeSliderProps) {
  const [values, setValues] = useState<[number, number]>(value || defaultValue);
  const minValRef = useRef<number>(values[0]);
  const maxValRef = useRef<number>(values[1]);

  useEffect(() => {
    if (value) {
      setValues(value);
      minValRef.current = value[0];
      maxValRef.current = value[1];
    }
  }, [value]);

  const getPercent = (value: number) => {
    return Math.round(((value - min) / (max - min)) * 100);
  };

  const handleMinChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.min(Number(event.target.value), values[1] - step);
    const newValues: [number, number] = [val, values[1]];
    if (!value) {
      setValues(newValues);
    }
    onChange?.(newValues);
  };

  const handleMaxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(Number(event.target.value), values[0] + step);
    const newValues: [number, number] = [values[0], val];
    if (!value) {
      setValues(newValues);
    }
    onChange?.(newValues);
  };

  const minPercent = getPercent(values[0]);
  const maxPercent = getPercent(values[1]);

  return (
    <div className={cn('relative w-full flex items-center h-5 py-2 select-none', className)}>
      {/* Underlying Styled Track */}
      <div className="absolute left-0 right-0 h-1 bg-bg-tertiary rounded-lg pointer-events-none" />
      
      {/* Highlighting Active Area */}
      <div
        className="absolute h-1 bg-accent rounded pointer-events-none"
        style={{
          left: `${minPercent}%`,
          right: `${100 - maxPercent}%`,
        }}
      />

      {/* Sliders */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={values[0]}
        onChange={handleMinChange}
        disabled={disabled}
        className={cn(
          'absolute left-0 w-full h-0 appearance-none pointer-events-none outline-none z-10',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:hover:bg-accent-hover [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-colors [&::-webkit-slider-thumb]:duration-150',
          '[&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:hover:bg-accent-hover [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:transition-colors [&::-moz-range-thumb]:duration-150',
          'disabled:opacity-50'
        )}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={values[1]}
        onChange={handleMaxChange}
        disabled={disabled}
        className={cn(
          'absolute left-0 w-full h-0 appearance-none pointer-events-none outline-none z-20',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:hover:bg-accent-hover [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-colors [&::-webkit-slider-thumb]:duration-150',
          '[&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:hover:bg-accent-hover [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:transition-colors [&::-moz-range-thumb]:duration-150',
          'disabled:opacity-50'
        )}
      />
    </div>
  );
}
