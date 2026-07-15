import { type ReactNode } from 'react';
import { Select } from '@/components/ui';
import { cn } from '@/components/ui/utils';

export interface VisualChannelConfigProps {
  label: string;
  mode: 'fixed' | 'mapped';
  onModeChange: (mode: 'fixed' | 'mapped') => void;
  fields: { value: string; label: string }[];
  selectedField: string;
  onFieldChange: (field: string) => void;
  fixedContent: ReactNode;
  mappedContent: ReactNode;
  className?: string;
}

export function VisualChannelConfig({
  label,
  mode,
  onModeChange,
  fields,
  selectedField,
  onFieldChange,
  fixedContent,
  mappedContent,
  className,
}: VisualChannelConfigProps) {
  return (
    <div className={cn('flex flex-col gap-2 font-sans text-xs', className)}>
      {/* Header with Mode Toggle Buttons */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-text-secondary uppercase text-xs tracking-[0.12em]">
          {label}
        </span>
        <div className="flex bg-bg-secondary p-0.5 rounded border border-border-primary">
          <button
            type="button"
            onClick={() => onModeChange('fixed')}
            className={cn(
              'px-2 py-1 rounded text-[10px] font-medium transition-all cursor-pointer',
              mode === 'fixed'
                ? 'bg-bg-active text-text-primary shadow-sm font-semibold'
                : 'text-text-tertiary hover:text-text-secondary'
            )}
          >
            Fixed
          </button>
          <button
            type="button"
            onClick={() => onModeChange('mapped')}
            className={cn(
              'px-2 py-1 rounded text-[10px] font-medium transition-all cursor-pointer',
              mode === 'mapped'
                ? 'bg-bg-active text-text-primary shadow-sm font-semibold'
                : 'text-text-tertiary hover:text-text-secondary'
            )}
          >
            Mapped
          </button>
        </div>
      </div>

      {/* Mode-Specific Content */}
      {mode === 'fixed' ? (
        <div className="flex flex-col gap-2 mt-0.5">{fixedContent}</div>
      ) : (
        <div className="flex flex-col gap-2 mt-0.5">
          {/* Column Select Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-text-tertiary font-medium">Select Column</label>
            <Select
              options={[{ value: '', label: 'Select field...' }, ...fields]}
              value={selectedField}
              onChange={(e) => onFieldChange(e.target.value)}
            />
          </div>
          {selectedField ? (
            <div className="flex flex-col gap-2 mt-1 animate-fade-in">{mappedContent}</div>
          ) : (
            <p className="text-[10px] text-text-tertiary text-center py-2">
              Please choose a column to map values.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
export default VisualChannelConfig;
