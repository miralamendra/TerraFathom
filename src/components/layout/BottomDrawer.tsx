import { useState } from 'react';
import { Table2, Play, X, ChevronUp } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { EmptyState } from '@/components/common/EmptyState';
import { useUIStore } from '@/stores/ui-store';
import { useDataStore } from '@/stores/data-store';
import { DataTable } from '@/components/datasets/DataTable';
import { AnimationPlayer } from '@/components/datasets/AnimationPlayer';
import { cn } from '@/components/ui/utils';

export function BottomDrawer() {
  const open = useUIStore((s) => s.bottomDrawerOpen);
  const height = useUIStore((s) => s.bottomDrawerHeight);
  const selectedDatasetId = useUIStore((s) => s.selectedDatasetId);
  const toggle = useUIStore((s) => s.toggleBottomDrawer);
  const datasets = useDataStore((s) => s.datasets);

  const [activeTab, setActiveTab] = useState<'table' | 'animation'>('table');

  const datasetName = selectedDatasetId ? datasets[selectedDatasetId]?.name : null;

  if (!open) {
    return (
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-30 select-none pointer-events-auto">
        <button
          type="button"
          onClick={toggle}
          className="h-7 px-4 flex items-center gap-1.5 bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover border-t border-x border-border-primary rounded-t-md text-xs font-semibold shadow-menu cursor-pointer transition-colors outline-none"
        >
          <Table2 size={12} />
          <span>Data Workspace</span>
          <ChevronUp size={12} className="text-text-tertiary" />
        </button>
      </div>
    );
  }

  return (
    <section
      className="absolute bottom-0 left-0 right-0 flex flex-col bg-bg-secondary border-t border-border-primary select-text z-30"
      style={{ height }}
    >
      {/* Header bar with browser-like tabs */}
      <header className="h-9 flex items-center justify-between border-b border-border-primary bg-bg-tertiary shrink-0 pr-4">
        <div className="flex items-center h-full">
          {/* Tab 1: Data Table */}
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={cn(
              'h-9 px-4 flex items-center gap-2 border-r border-border-primary text-xs font-semibold tracking-wide transition-colors cursor-pointer select-none outline-none',
              activeTab === 'table'
                ? 'bg-bg-secondary text-text-primary border-t-2 border-t-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/30'
            )}
          >
            <Table2 size={13} />
            <span>Data Table</span>
          </button>
          
          {/* Tab 2: Animation Player */}
          <button
            type="button"
            onClick={() => setActiveTab('animation')}
            className={cn(
              'h-9 px-4 flex items-center gap-2 border-r border-border-primary text-xs font-semibold tracking-wide transition-colors cursor-pointer select-none outline-none',
              activeTab === 'animation'
                ? 'bg-bg-secondary text-text-primary border-t-2 border-t-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/30'
            )}
          >
            <Play size={13} fill={activeTab === 'animation' ? 'currentColor' : 'none'} />
            <span>Animation Player</span>
          </button>

          {datasetName && (
            <span className="text-[10px] text-text-tertiary select-none font-mono font-medium ml-3.5">
              - {datasetName}
            </span>
          )}
        </div>
        <IconButton variant="ghost" size="sm" onClick={toggle} title="Close Panel">
          <X size={14} />
        </IconButton>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative">
        {selectedDatasetId ? (
          activeTab === 'table' ? (
            <DataTable />
          ) : (
            <AnimationPlayer />
          )
        ) : (
          <div className="h-full flex items-center justify-center p-4">
            <EmptyState
              icon={activeTab === 'table' ? <Table2 size={20} /> : <Play size={20} />}
              title="No active dataset"
              description="Import and select a dataset to inspect attributes or play animations."
            />
          </div>
        )}
      </div>
    </section>
  );
}
export default BottomDrawer;

