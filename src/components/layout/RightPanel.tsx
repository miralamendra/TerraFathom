import { Sliders, HelpCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui';
import { EmptyState } from '@/components/common/EmptyState';
import { useUIStore } from '@/stores/ui-store';

export function RightPanel() {
  const open = useUIStore((s) => s.rightPanelOpen);
  const width = useUIStore((s) => s.rightPanelWidth);
  const selectedLayerId = useUIStore((s) => s.selectedLayerId);

  if (!open) return null;

  return (
    <aside
      className="h-full flex flex-col bg-bg-secondary border-l border-border-primary select-none shrink-0"
      style={{ width }}
    >
      <ScrollArea className="flex-1 p-4">
        <header className="mb-4 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            Layer Properties
          </span>
          <HelpCircle size={14} className="text-text-tertiary cursor-help" />
        </header>

        {selectedLayerId ? (
          <div className="flex flex-col gap-4 text-text-secondary text-xs">
            {/* Mock properties controls */}
            <p>Layer ID: {selectedLayerId}</p>
          </div>
        ) : (
          <EmptyState
            icon={<Sliders size={20} />}
            title="No layer selected"
            description="Select a layer from the list to modify its opacity, radius, height, color palette, and data filters."
          />
        )}
      </ScrollArea>
    </aside>
  );
}
