import { create } from 'zustand';
import { type LayerInstance, type LayerType, type LayerConfig } from '@/core/layers/base-layer';
import { getLayerDefinition } from '@/core/layers/layer-registry';
import { useUIStore } from './ui-store';

interface LayerState {
  layers: LayerInstance[];
  selectedLayerId: string | null;

  addLayer: (datasetId: string, type: LayerType, name: string, configOverrides?: Partial<LayerConfig>) => void;
  removeLayer: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  updateLayerConfig: (id: string, config: Partial<LayerConfig>) => void;
  selectLayer: (id: string | null) => void;
  reorderLayers: (layers: LayerInstance[]) => void;
  moveLayer: (index: number, direction: 'up' | 'down') => void;
  removeLayersForDataset: (datasetId: string) => void;
}

export const useLayerStore = create<LayerState>((set, get) => ({
  layers: [],
  selectedLayerId: null,

  addLayer: (datasetId, type, name, configOverrides) => {
    const def = getLayerDefinition(type);
    if (!def) return;

    const newLayer: LayerInstance = {
      id: `layer-${type}-${Math.random().toString(36).substring(2, 11)}`,
      name,
      type,
      datasetId,
      config: { ...def.defaultConfig, ...configOverrides },
    };

    set((state) => ({
      layers: [newLayer, ...state.layers],
    }));

    // Auto-select the newly created layer
    get().selectLayer(newLayer.id);
  },

  removeLayer: (id) => {
    set((state) => {
      const nextLayers = state.layers.filter((l) => l.id !== id);
      const isSelected = state.selectedLayerId === id;
      const nextSelected = isSelected ? null : state.selectedLayerId;

      if (isSelected) {
        useUIStore.getState().setSelectedLayerId(null);
      }

      return {
        layers: nextLayers,
        selectedLayerId: nextSelected,
      };
    });
  },

  toggleLayerVisibility: (id) => {
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, config: { ...l.config, visible: !l.config.visible } } : l
      ),
    }));
  },

  updateLayerConfig: (id, config) => {
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, config: { ...l.config, ...config } } : l
      ),
    }));
  },

  selectLayer: (id) => {
    set({ selectedLayerId: id });
    useUIStore.getState().setSelectedLayerId(id);
    if (id) {
      useUIStore.getState().setRightPanelOpen(true);
    }
  },

  reorderLayers: (nextLayers) => {
    set({ layers: nextLayers });
  },

  moveLayer: (index, direction) => {
    const layers = [...get().layers];
    if (direction === 'up' && index > 0) {
      const temp = layers[index];
      layers[index] = layers[index - 1];
      layers[index - 1] = temp;
    } else if (direction === 'down' && index < layers.length - 1) {
      const temp = layers[index];
      layers[index] = layers[index + 1];
      layers[index + 1] = temp;
    }
    set({ layers });
  },

  removeLayersForDataset: (datasetId) => {
    set((state) => {
      const nextLayers = state.layers.filter((l) => l.datasetId !== datasetId);
      const isSelectedOrphaned = state.layers.some(
        (l) => l.id === state.selectedLayerId && l.datasetId === datasetId
      );
      
      const nextSelected = isSelectedOrphaned ? null : state.selectedLayerId;
      if (isSelectedOrphaned) {
        useUIStore.getState().setSelectedLayerId(null);
      }

      return {
        layers: nextLayers,
        selectedLayerId: nextSelected,
      };
    });
  },
}));
