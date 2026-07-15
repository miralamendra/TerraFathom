import { useState } from 'react';
import { Button, Input, Divider } from '@/components/ui';
import { Square, CheckSquare } from 'lucide-react';
import { cn } from '@/components/ui/utils';

export interface ValueFilterProps {
  uniqueValues: (string | number | boolean | null)[];
  value: (string | number | boolean | null)[];
  onChange: (val: (string | number | boolean | null)[]) => void;
}

export function ValueFilter({ uniqueValues, value, onChange }: ValueFilterProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const toggleValue = (val: string | number | boolean | null) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const selectAll = () => {
    onChange([...uniqueValues]);
  };

  const selectNone = () => {
    onChange([]);
  };

  const filteredItems = uniqueValues.filter((item) => {
    const str = item === null || item === undefined ? 'null/empty' : String(item);
    return str.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-2 font-sans text-xs">
      {/* Search Input */}
      <Input
        placeholder="Search categories..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="h-8 text-xs bg-bg-tertiary"
      />

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7 py-0.5 px-2">
          Select All
        </Button>
        <Button variant="ghost" size="sm" onClick={selectNone} className="text-xs h-7 py-0.5 px-2">
          Select None
        </Button>
      </div>

      <Divider />

      {/* Scrollable list */}
      <div className="max-h-[140px] overflow-y-auto flex flex-col gap-1 rounded-md bg-bg-tertiary/20 p-1.5 border border-border-primary/40">
        {filteredItems.length === 0 ? (
          <p className="text-xs text-text-tertiary text-center py-4">No categories found</p>
        ) : (
          filteredItems.map((item) => {
            const labelStr = item === null || item === undefined ? 'Null/Empty' : String(item);
            const isChecked = value.includes(item);

            return (
              <label
                key={labelStr}
                className={cn(
                  'flex items-center gap-2.5 px-2 py-1 rounded-md cursor-pointer transition-colors select-none',
                  isChecked ? 'bg-bg-active/30 hover:bg-bg-hover' : 'hover:bg-bg-hover'
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleValue(item)}
                  className="hidden"
                />
                <span className="text-text-secondary shrink-0">
                  {isChecked ? (
                    <CheckSquare size={14} className="text-accent" />
                  ) : (
                    <Square size={14} className="text-text-tertiary" />
                  )}
                </span>
                <span className="text-xs text-text-primary truncate" title={labelStr}>
                  {labelStr}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
export default ValueFilter;
