import { Database, Trash2, FileText } from 'lucide-react';
import { type ProcessedDataset } from '@/types/dataset';
import { IconButton } from '@/components/ui';
import { cn } from '@/components/ui/utils';

export interface DatasetItemProps {
  dataset: ProcessedDataset;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

export function DatasetItem({ dataset, selected, onSelect, onRemove }: DatasetItemProps) {
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selection trigger on click
    onRemove();
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group flex items-center justify-between h-9 transition-colors duration-150 cursor-pointer select-none pl-3 pr-2 border-b border-border-secondary/35 last:border-b-0',
        selected
          ? 'bg-bg-active text-text-primary'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Format Icon */}
        <span className="p-1 rounded shrink-0 bg-bg-tertiary text-text-secondary">
          {dataset.format === 'csv' ? <FileText size={16} /> : <Database size={16} />}
        </span>

        {/* Name and count */}
        <div className="min-w-0 flex flex-col">
          <span className="text-base font-medium text-text-primary truncate max-w-[150px]" title={dataset.name}>
            {dataset.name}
          </span>
          <span className="text-xs text-text-tertiary leading-tight">
            {dataset.rowCount.toLocaleString()} rows
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* Color Badge Indicator */}
        <span className={cn('w-2 h-2 rounded-full border border-black/20', dataset.color)} />

        {/* Delete Action */}
        <IconButton
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          title="Remove Dataset"
          className="opacity-0 group-hover:opacity-100 hover:text-error hover:bg-bg-active transition-all"
        >
          <Trash2 size={16} />
        </IconButton>
      </div>
    </div>
  );
}
export default DatasetItem;
