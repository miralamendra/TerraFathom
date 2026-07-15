import { useState, useEffect } from 'react';
import { RangeSlider } from '@/components/ui/RangeSlider';
import { NumberInput } from '@/components/ui';

export interface RangeFilterProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (val: [number, number]) => void;
}

export function RangeFilter({ min, max, value, onChange }: RangeFilterProps) {
  const [localValue, setLocalValue] = useState<[number, number]>(value);

  // Sync state if store updates from elsewhere
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced update to the store
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue[0] !== value[0] || localValue[1] !== value[1]) {
        onChange(localValue);
      }
    }, 80);

    return () => clearTimeout(handler);
  }, [localValue, onChange, value]);

  const step = (max - min) / 100 || 1;
  const formattedStep = step < 1 ? parseFloat(step.toFixed(4)) : Math.round(step);

  return (
    <div className="flex flex-col gap-2 font-sans text-xs">
      <RangeSlider
        min={min}
        max={max}
        step={formattedStep}
        value={localValue}
        onChange={(val) => setLocalValue(val)}
      />
      <div className="flex items-center gap-2 mt-1">
        <div className="flex-1">
          <NumberInput
            min={min}
            max={max}
            step={formattedStep}
            value={localValue[0]}
            onChange={(val) => setLocalValue([val, localValue[1]])}
          />
        </div>
        <span className="text-text-tertiary">-</span>
        <div className="flex-1">
          <NumberInput
            min={min}
            max={max}
            step={formattedStep}
            value={localValue[1]}
            onChange={(val) => setLocalValue([localValue[0], val])}
          />
        </div>
      </div>
    </div>
  );
}
export default RangeFilter;
