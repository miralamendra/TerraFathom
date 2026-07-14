import { Table2, X } from 'lucide-react';
import { ScrollArea, IconButton } from '@/components/ui';
import { EmptyState } from '@/components/common/EmptyState';
import { useUIStore } from '@/stores/ui-store';

export function BottomDrawer() {
  const open = useUIStore((s) => s.bottomDrawerOpen);
  const height = useUIStore((s) => s.bottomDrawerHeight);
  const selectedDatasetId = useUIStore((s) => s.selectedDatasetId);
  const toggle = useUIStore((s) => s.toggleBottomDrawer);

  if (!open) return null;

  return (
    <section
      className="w-full flex flex-col bg-bg-secondary border-t border-border-primary select-none shrink-0"
      style={{ height }}
    >
      {/* Header bar */}
      <header className="h-9 px-4 flex items-center justify-between border-b border-border-primary bg-bg-tertiary shrink-0">
        <div className="flex items-center gap-2">
          <Table2 className="text-accent" size={14} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            Data Table
          </span>
          {selectedDatasetId && (
            <span className="text-[10px] text-text-secondary bg-bg-primary px-1.5 py-0.5 rounded border border-border-primary">
              {selectedDatasetId}
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
          <ScrollArea className="h-full p-4">
            <div className="text-text-secondary text-xs">
              {/* Mock data table */}
              <p>Tabular view for dataset: {selectedDatasetId}</p>
            </div>
          </ScrollArea>
        ) : (
          <div className="h-full flex items-center justify-center p-4">
            <EmptyState
              icon={<Table2 size={20} />}
              title="No active dataset"
              description="Import and select a dataset to inspect attribute rows and coordinate fields."
            />
          </div>
        )}
      </div>
    </section>
  );
}
