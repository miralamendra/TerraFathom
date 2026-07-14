import { Database, Layers, FolderOpen, Plus } from 'lucide-react';
import { Button, ScrollArea } from '@/components/ui';
import { EmptyState } from '@/components/common/EmptyState';
import { useUIStore } from '@/stores/ui-store';

export function LeftPanel() {
  const open = useUIStore((s) => s.leftPanelOpen);
  const width = useUIStore((s) => s.leftPanelWidth);

  if (!open) return null;

  return (
    <aside
      className="h-full flex flex-col bg-bg-secondary border-r border-border-primary select-none shrink-0"
      style={{ width }}
    >
      <ScrollArea className="flex-1 p-4">
        {/* DATASETS Section */}
        <section className="mb-6">
          <header className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Datasets
            </span>
            <span className="text-[10px] text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded border border-border-secondary">
              0 Active
            </span>
          </header>

          <EmptyState
            icon={<Database size={20} />}
            title="No datasets imported"
            description="Import CSV or GeoJSON files to begin visualizing geospatial layers."
            action={
              <Button size="sm" variant="secondary" className="gap-1">
                <FolderOpen size={12} />
                <span>Browse Files</span>
              </Button>
            }
          />
        </section>

        {/* LAYERS Section */}
        <section>
          <header className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Layers
            </span>
            <span className="text-[10px] text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded border border-border-secondary">
              0 Active
            </span>
          </header>

          <EmptyState
            icon={<Layers size={20} />}
            title="No layers added"
            description="Create visual representations like heatmaps, hexagons, and arcs."
            action={
              <Button size="sm" variant="secondary" disabled className="gap-1">
                <Plus size={12} />
                <span>Add Layer</span>
              </Button>
            }
          />
        </section>
      </ScrollArea>
    </aside>
  );
}
