import { useLayerStore } from '@/stores/layer-store';
import { LayerItem } from './LayerItem';
import { toast } from 'sonner';

export function LayerList() {
  const layers = useLayerStore((s) => s.layers);
  const selectedId = useLayerStore((s) => s.selectedLayerId);
  
  const selectLayer = useLayerStore((s) => s.selectLayer);
  const removeLayer = useLayerStore((s) => s.removeLayer);
  const toggleVisibility = useLayerStore((s) => s.toggleLayerVisibility);
  const moveLayer = useLayerStore((s) => s.moveLayer);

  if (layers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center select-none">
        <span className="text-xs text-text-tertiary">No active map layers</span>
        <span className="text-[11px] text-text-tertiary/60 mt-0.5">Add a visualization layer below</span>
      </div>
    );
  }

  const handleRemove = (id: string, name: string) => {
    removeLayer(id);
    toast.success(`Removed layer: ${name}`);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    moveLayer(index, direction);
    toast.info(`Moved layer ${direction === 'up' ? 'up' : 'down'} the map stack`);
  };

  return (
    <div className="flex flex-col gap-2">
      {layers.map((layer, index) => (
        <LayerItem
          key={layer.id}
          layer={layer}
          selected={selectedId === layer.id}
          onSelect={() => selectLayer(layer.id)}
          onToggleVisible={() => toggleVisibility(layer.id)}
          onRemove={() => handleRemove(layer.id, layer.name)}
          onMoveUp={() => handleMove(index, 'up')}
          onMoveDown={() => handleMove(index, 'down')}
          canMoveUp={index > 0}
          canMoveDown={index < layers.length - 1}
        />
      ))}
    </div>
  );
}
export default LayerList;
