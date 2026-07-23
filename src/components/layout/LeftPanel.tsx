import { useDataStore } from '@/stores/data-store';
import { useLayerStore } from '@/stores/layer-store';
import { useUIStore } from '@/stores/ui-store';
import { useFileDrop } from '@/hooks/use-file-drop';
import { DatasetSection } from '@/components/datasets/DatasetSection';
import { FilterSection } from '@/components/datasets/FilterSection';
import { SAMPLE_DATASETS, loadSampleDataset } from '@/core/data/sample-data';
import { Database, Plus, UploadCloud, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { useRef, useState, useEffect } from 'react';
import { AIChatbot } from './AIChatbot';

export function LeftPanel() {
  const open = useUIStore((s) => s.leftPanelOpen);
  const width = useUIStore((s) => s.leftPanelWidth);

  const datasets = useDataStore((s) => s.datasets);
  const layers = useLayerStore((s) => s.layers);

  const fileDrop = useFileDrop();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const datasetList = Object.values(datasets);

  const [samplesOpen, setSamplesOpen] = useState(false);
  const samplesRef = useRef<HTMLDivElement>(null);

  const activeTab = useUIStore((s) => s.leftPanelActiveTab);

  // Section collapsible states
  const [datasetsExpanded, setDatasetsExpanded] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [samplesExpanded, setSamplesExpanded] = useState(true);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (samplesRef.current && !samplesRef.current.contains(e.target as Node)) {
        setSamplesOpen(false);
      }
    };
    if (samplesOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [samplesOpen]);

  const handleLoadSample = async (sampleId: string) => {
    try {
      await loadSampleDataset(sampleId);
    } catch {
      // error handled inside loadSampleDataset
    }
  };

  if (!open) return null;

  return (
    <aside
      className="h-full flex flex-col bg-bg-secondary select-text shrink-0 relative transition-all duration-500"
      style={{ width }}
      onDragOver={activeTab === 'workspace' ? fileDrop.handleDragOver : undefined}
      onDragLeave={activeTab === 'workspace' ? fileDrop.handleDragLeave : undefined}
      onDrop={activeTab === 'workspace' ? fileDrop.handleDrop : undefined}
    >
      {/* Drag Overlay */}
      {fileDrop.isDragOver && activeTab === 'workspace' && (
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

      {activeTab === 'ai' ? (
        <div className="flex-1 min-h-0 flex flex-col p-2.5">
          <AIChatbot fullPanelMode />
        </div>
      ) : (
        <div className="overflow-y-auto scrollbar-thin flex-1 min-h-0">
          <div className="px-3 pb-6 flex flex-col gap-5 mt-3">
            
            {/* Datasets list (with nested layers) */}
            <div className="flex flex-col gap-1.5">
              <SectionHeader 
                title="Datasets" 
                expanded={datasetsExpanded}
                onToggle={() => setDatasetsExpanded(!datasetsExpanded)}
                action={
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="w-4.5 h-4.5 flex items-center justify-center rounded-[4px] hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                    title="Import Dataset"
                  >
                    <Plus size={11} />
                  </button>
                }
              />
              
              {datasetsExpanded && (
                datasetList.length === 0 ? (
                  <div className="mx-2 mt-1 py-8 flex flex-col items-center text-center bg-gradient-to-b from-bg-tertiary/10 to-transparent rounded-2xl border border-white/[0.04] shadow-inner transition-all duration-500 hover:border-white/[0.08] group">
                    <div className="w-10 h-10 rounded-full bg-bg-tertiary/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-500 border border-white/[0.05] relative">
                      <div className="absolute inset-0 rounded-full bg-accent/5 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <Database size={16} className="text-text-tertiary opacity-70 group-hover:text-text-secondary transition-colors" strokeWidth={1.5} />
                    </div>
                    <span className="text-[12px] font-medium text-text-primary tracking-tight">No data loaded</span>
                    <span className="text-[10px] text-text-tertiary max-w-[150px] mt-1.5 leading-relaxed opacity-70">
                      Drag & drop files or click + to begin
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
                )
              )}
            </div>

            {/* Filters section */}
            {datasetList.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <SectionHeader 
                  title="Active Filters" 
                  expanded={filtersExpanded}
                  onToggle={() => setFiltersExpanded(!filtersExpanded)}
                />
                {filtersExpanded && <FilterSection />}
              </div>
            )}

            {/* Samples */}
            <div className="flex flex-col gap-1.5">
              <SectionHeader 
                title="Sample data" 
                expanded={samplesExpanded}
                onToggle={() => setSamplesExpanded(!samplesExpanded)}
              />
              
              {samplesExpanded && (
                <div className="grid grid-cols-3 gap-1.5 px-2">
                  {SAMPLE_DATASETS.map((sample) => {
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
                        onClick={() => handleLoadSample(sample.id)}
                        className={cn(
                          'relative flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-center transition-all duration-300 cursor-pointer select-none group',
                          isLoaded
                            ? 'opacity-30 bg-bg-tertiary/5 border-transparent text-text-tertiary pointer-events-none'
                            : 'bg-bg-tertiary/10 border-white/[0.04] text-text-secondary hover:bg-bg-tertiary/25 hover:text-text-primary active:scale-95'
                        )}
                      >
                        <span className="text-[10px] font-semibold tracking-tight truncate w-full px-0.5">{displayName}</span>
                        <span className="text-[8px] text-text-tertiary mt-0.5 uppercase tracking-wider">{sample.format}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

interface SectionHeaderProps {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
}

function SectionHeader({
  title,
  hint,
  action,
  expanded = true,
  onToggle,
}: SectionHeaderProps) {
  return (
    <div 
      onClick={onToggle}
      className={`flex items-center justify-between mb-1 px-2 h-6 select-none ${onToggle ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        {onToggle && (
          <span className="text-text-tertiary">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
        <span className="text-[13px] font-semibold text-text-primary tracking-tight">{title}</span>
      </div>
      
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {hint && <span className="text-[10px] text-text-tertiary/60 font-medium uppercase tracking-[0.05em]">{hint}</span>}
        {action}
      </div>
    </div>
  );
}

export default LeftPanel;
