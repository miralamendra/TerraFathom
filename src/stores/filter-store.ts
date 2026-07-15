import { create } from 'zustand';
import { type Filter, type FilterValue } from '@/core/filters/filter-types';

interface FilterState {
  filters: Filter[];

  addFilter: (datasetId: string, fieldName: string, type: 'range' | 'value', value: FilterValue) => void;
  removeFilter: (id: string) => void;
  updateFilterValue: (id: string, value: FilterValue) => void;
  toggleFilterActive: (id: string) => void;
  removeFiltersForDataset: (datasetId: string) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  filters: [],

  addFilter: (datasetId, fieldName, type, value) => {
    const newFilter: Filter = {
      id: `filter-${Math.random().toString(36).substring(2, 11)}`,
      datasetId,
      fieldName,
      type,
      value,
      active: true,
    };

    set((state) => ({
      filters: [...state.filters, newFilter],
    }));
  },

  removeFilter: (id) => {
    set((state) => ({
      filters: state.filters.filter((f) => f.id !== id),
    }));
  },

  updateFilterValue: (id, value) => {
    set((state) => ({
      filters: state.filters.map((f) => (f.id === id ? { ...f, value } : f)),
    }));
  },

  toggleFilterActive: (id) => {
    set((state) => ({
      filters: state.filters.map((f) => (f.id === id ? { ...f, active: !f.active } : f)),
    }));
  },

  removeFiltersForDataset: (datasetId) => {
    set((state) => ({
      filters: state.filters.filter((f) => f.datasetId !== datasetId),
    }));
  },
}));
