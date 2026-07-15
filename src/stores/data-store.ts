import { create } from 'zustand';
import { type ProcessedDataset } from '@/types/dataset';
import { useUIStore } from './ui-store';
import { useMapStore } from './map-store';
import { useLayerStore } from './layer-store';
import { useFilterStore } from './filter-store';
import { useAnimationStore } from './animation-store';
import { getCompatibleLayers } from '@/core/layers/layer-registry';
import { getViewportForDataset } from '@/core/map/viewport';

interface DataState {
  datasets: Record<string, ProcessedDataset>;
  selectedDatasetId: string | null;

  addDataset: (dataset: ProcessedDataset) => void;
  removeDataset: (id: string) => void;
  selectDataset: (id: string | null) => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  datasets: {},
  selectedDatasetId: null,

  addDataset: (dataset) => {
    set((state) => ({
      datasets: {
        ...state.datasets,
        [dataset.id]: dataset,
      },
    }));

    // Auto-select the newly added dataset
    get().selectDataset(dataset.id);

    // Auto-create sensible default visualization layers
    const nameLower = dataset.name.toLowerCase();
    const { addLayer } = useLayerStore.getState();

    if (nameLower.includes('taxi') || nameLower.includes('movement') || nameLower.includes('transit')) {
      // Create both scatterplot and geojson layers by default for taxi/movement/transit
      addLayer(dataset.id, 'scatterplot', `${dataset.name} Points`, {
        colorMode: 'mapped',
        colorField: 'total_duration',
        colorPalette: 'magma',
        strokeWidth: 0,
      });
      const compatibles = getCompatibleLayers(dataset);
      if (compatibles.some((c) => c.type === 'geojson')) {
        addLayer(dataset.id, 'geojson', `${dataset.name} Polygons`, {
          colorMode: 'mapped',
          colorField: 'total_duration',
          colorPalette: 'magma',
          strokeWidth: 0,
        });
      }
    } else if (nameLower.includes('earthquake')) {
      // Heatmap density and scatter points with custom defaults
      addLayer(dataset.id, 'heatmap', `${dataset.name} Density`, {
        colorPalette: 'redBlue',
      });
      addLayer(dataset.id, 'scatterplot', `${dataset.name} Points`, {
        fillColor: [75, 85, 99], // Cool Gray #4B5563
      });
    } else {
      // General fallbacks
      const compatibles = getCompatibleLayers(dataset);
      if (compatibles.length > 0) {
        const firstType = compatibles[0].type;
        addLayer(dataset.id, firstType, `${dataset.name} Visual`);
      }
    }
  },

  removeDataset: (id) => {
    // Cascade delete of layers and filters linked to this dataset
    useLayerStore.getState().removeLayersForDataset(id);
    useFilterStore.getState().removeFiltersForDataset(id);

    set((state) => {
      const nextDatasets = { ...state.datasets };
      delete nextDatasets[id];

      const isCurrentSelected = state.selectedDatasetId === id;
      const nextSelected = isCurrentSelected ? null : state.selectedDatasetId;

      if (isCurrentSelected) {
        useUIStore.getState().setSelectedDatasetId(null);
      }

      return {
        datasets: nextDatasets,
        selectedDatasetId: nextSelected,
      };
    });
  },

  selectDataset: (id) => {
    set({ selectedDatasetId: id });
    useUIStore.getState().setSelectedDatasetId(id);
    useUIStore.getState().setSelectedRowIndex(null);
    useAnimationStore.getState().reset();

    if (id) {
      const dataset = get().datasets[id];
      if (dataset) {
        const newVp = getViewportForDataset(dataset);
        const drawerOpen = useUIStore.getState().bottomDrawerOpen;
        // Shift map camera further south to push visual elements higher up (north) out of bottom drawer's way
        const latOffset = drawerOpen ? (42 / Math.pow(2, newVp.zoom)) : 0;

        useMapStore.getState().animateViewport({
          longitude: newVp.longitude,
          latitude: newVp.latitude - latOffset,
          zoom: newVp.zoom,
          pitch: newVp.pitch,
          bearing: newVp.bearing,
        }, 1500);
      }
    }
  },
}));
