import { ScrollArea } from '@/components/ui';
import { useDataStore } from '@/stores/data-store';
import { useLayerStore } from '@/stores/layer-store';
import { useUIStore } from '@/stores/ui-store';
import { useFileDrop } from '@/hooks/use-file-drop';
import { DatasetSection } from '@/components/datasets/DatasetSection';
import { FilterSection } from '@/components/datasets/FilterSection';
import { SAMPLE_DATASETS } from '@/core/data/sample-data';
import { processDataset } from '@/core/data/processors/data-processor';
import { DATASET_COLORS } from '@/core/colors/constants';
import { toast } from 'sonner';
import { Database, Plus, UploadCloud } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { useRef, useState, useEffect } from 'react';
import { AIChatbot } from './AIChatbot';

export function LeftPanel() {
  const open = useUIStore((s) => s.leftPanelOpen);
  const width = useUIStore((s) => s.leftPanelWidth);

  const datasets = useDataStore((s) => s.datasets);
  const addDataset = useDataStore((s) => s.addDataset);
  const layers = useLayerStore((s) => s.layers);

  const fileDrop = useFileDrop();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const datasetList = Object.values(datasets);

  const [samplesOpen, setSamplesOpen] = useState(false);
  const samplesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (samplesRef.current && !samplesRef.current.contains(e.target as Node)) {
        setSamplesOpen(false);
      }
    };
    if (samplesOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [samplesOpen]);

  const handleLoadSample = async (sampleId: string, colorIndex: number) => {
    const sample = SAMPLE_DATASETS.find((s) => s.id === sampleId);
    if (!sample) return;

    const toastId = toast.loading(`Loading ${sample.name}…`);
    try {
      const response = await fetch(sample.path);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const text = await response.text();
      const color = DATASET_COLORS[colorIndex % DATASET_COLORS.length].bgClass;
      const processed = processDataset(sample.name, text, sample.format, color);
      addDataset(processed);
      toast.success(`Loaded ${sample.name}`, { id: toastId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to load sample: ${msg}`, { id: toastId });
    }
  };

  if (!open) return null;

  return (
    <aside
      className="h-full flex flex-col bg-bg-secondary border-r border-border-primary select-none shrink-0 relative transition-all duration-500"
      style={{ width }}
      onDragOver={fileDrop.handleDragOver}
      onDragLeave={fileDrop.handleDragLeave}
      onDrop={fileDrop.handleDrop}
    >
      {/* Drag Overlay */}
      {fileDrop.isDragOver && (
        <div className="absolute inset-0 z-50 bg-bg-secondary/40 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="bg-bg-elevated/80 border border-accent/30 shadow-2xl rounded-2xl p-8 flex flex-col items-center max-w-[80%] text-center">
            <UploadCloud size={32} className="text-accent mb-3 animate-bounce" strokeWidth={1.5} />
            <span className="text-[14px] font-medium text-text-primary tracking-tight">Drop your file here</span>
            <span className="text-[11px] text-text-tertiary mt-1.5 leading-relaxed">CSV, JSON, or GeoJSON supported</span>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={fileDrop.handleFileChange}
        accept=".csv,.geojson,application/json"
        className="hidden"
      />

      {/* Workspace Header */}
      <div className="px-4 py-3.5 flex items-center justify-between border-b border-border-primary shrink-0">
        <span className="text-[16px] font-bold text-text-primary tracking-tight">Workspace</span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative flex items-center justify-center w-7 h-7 rounded-full bg-bg-tertiary/20 hover:bg-bg-elevated transition-all duration-300 border border-border-primary/20 hover:border-border-primary/60 cursor-pointer"
          title="Import Dataset"
        >
          <Plus size={13} className="text-text-secondary group-hover:text-text-primary transition-colors duration-300 group-hover:scale-110" strokeWidth={1.5} />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 pb-6 flex flex-col gap-6 mt-2">
          
          {/* Datasets list (with nested layers) */}
          <div className="flex flex-col gap-2">
            <SectionHeader 
              title="Datasets" 
              action={
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-4.5 h-4.5 flex items-center justify-center rounded-[4px] hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                  title="Import Dataset"
                >
                  <Plus size={11} />
                </button>
              }
            />
            
            {datasetList.length === 0 ? (
              <div className="mx-2 mt-2 py-10 flex flex-col items-center text-center bg-gradient-to-b from-bg-tertiary/10 to-transparent rounded-2xl border border-border-primary/20 shadow-inner transition-all duration-500 hover:border-border-primary/40 group">
                <div className="w-12 h-12 rounded-full bg-bg-tertiary/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-500 border border-border-primary/20 relative">
                  <div className="absolute inset-0 rounded-full bg-accent/5 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <Database size={18} className="text-text-tertiary opacity-70 group-hover:text-text-secondary transition-colors" strokeWidth={1.5} />
                </div>
                <span className="text-[13px] font-medium text-text-primary tracking-tight">No data loaded</span>
                <span className="text-[11px] text-text-tertiary max-w-[160px] mt-2 leading-relaxed opacity-70">
                  Drag & drop files or click the + button to begin
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {datasetList.map((dataset) => (
                  <DatasetSection
                    key={dataset.id}
                    dataset={dataset}
                    layers={layers.filter((l) => l.datasetId === dataset.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Filters section */}
          {datasetList.length > 0 && (
            <div className="flex flex-col gap-2">
              <SectionHeader title="Active Filters" />
              <FilterSection />
            </div>
          )}

          {/* Samples */}
          <div className="flex flex-col gap-2">
            <SectionHeader title="Sample data" />
            <div className="grid grid-cols-3 gap-1.5 px-2">
              {SAMPLE_DATASETS.map((sample, idx) => {
                const isLoaded = datasetList.some((d) => d.name === sample.name);
                const displayName = 
                  sample.name === 'Pittsburgh Transit' 
                    ? 'Transit' 
                    : sample.name === 'NYC Taxi Trips' 
                      ? 'NYC Taxi' 
                      : sample.name;
                return (
                  <button
                    key={sample.id}
                    type="button"
                    disabled={isLoaded}
                    onClick={() => handleLoadSample(sample.id, idx)}
                    className={cn(
                      'relative flex flex-col items-center justify-center py-2.5 px-1.5 rounded-lg border text-center transition-all duration-300 cursor-pointer select-none group',
                      isLoaded
                        ? 'opacity-30 bg-bg-tertiary/5 border-transparent text-text-tertiary pointer-events-none'
                        : 'bg-bg-tertiary/5 text-text-secondary hover:bg-bg-tertiary/15 hover:text-text-primary active:scale-95 animate-pulse-glow'
                    )}
                  >
                    <span className="text-[10px] font-semibold tracking-tight truncate w-full px-0.5">{displayName}</span>
                    <span className="text-[8px] text-text-tertiary mt-0.5 uppercase tracking-wider">{sample.format}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Chatbot */}
          <AIChatbot />
        </div>
      </ScrollArea>
    </aside>
  );
}

function SectionHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-2 px-2 h-6">
      <span className="text-[13px] font-semibold text-text-primary tracking-tight">{title}</span>
      <div className="flex items-center gap-2">
        {hint && <span className="text-[10px] text-text-tertiary/60 font-medium uppercase tracking-[0.05em]">{hint}</span>}
        {action}
      </div>
    </div>
  );
}

export default LeftPanel;
