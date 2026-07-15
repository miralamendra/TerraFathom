import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/components/ui/utils';

export interface DataUploadProps {
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function DataUpload({
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
}: DataUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={handleClick}
      className={cn(
        'flex items-center gap-3 py-2.5 px-3 rounded-control bg-bg-tertiary/40 cursor-pointer select-none transition-all duration-150',
        isDragOver
          ? 'bg-bg-active'
          : 'hover:bg-bg-hover'
      )}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        accept=".csv,.geojson,application/json"
        className="hidden"
      />
      <Upload size={16} className="text-text-secondary shrink-0" />
      <div className="flex flex-col text-left min-w-0">
        <span className="text-xs font-medium text-text-primary leading-tight">Import geospatial data</span>
        <span className="text-[10px] text-text-tertiary mt-0.5">Drag CSV/GeoJSON or click to browse</span>
      </div>
    </div>
  );
}
export default DataUpload;
