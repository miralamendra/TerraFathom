import { create } from 'zustand';

interface UIState {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  bottomDrawerOpen: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
  bottomDrawerHeight: number;
  selectedLayerId: string | null;
  selectedDatasetId: string | null;
  selectedRowIndex: number | null;
  commandPaletteOpen: boolean;

  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleBottomDrawer: () => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setBottomDrawerHeight: (height: number) => void;
  setSelectedLayerId: (id: string | null) => void;
  setSelectedDatasetId: (id: string | null) => void;
  setSelectedRowIndex: (index: number | null) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
}

// LocalStorage Helper Keys
const STORAGE_PREFIX = 'geospatial-platform-ui:';
const getStorageValue = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setStorageValue = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
};

export const useUIStore = create<UIState>((set) => ({
  leftPanelOpen: getStorageValue('leftPanelOpen', true),
  rightPanelOpen: getStorageValue('rightPanelOpen', false),
  bottomDrawerOpen: getStorageValue('bottomDrawerOpen', false),
  leftPanelWidth: getStorageValue('leftPanelWidth', 320),
  rightPanelWidth: getStorageValue('rightPanelWidth', 320),
  bottomDrawerHeight: getStorageValue('bottomDrawerHeight', 240),
  selectedLayerId: null,
  selectedDatasetId: null,
  commandPaletteOpen: false,

  toggleLeftPanel: () =>
    set((state) => {
      const next = !state.leftPanelOpen;
      setStorageValue('leftPanelOpen', next);
      return { leftPanelOpen: next };
    }),

  toggleRightPanel: () =>
    set((state) => {
      const next = !state.rightPanelOpen;
      setStorageValue('rightPanelOpen', next);
      return { rightPanelOpen: next };
    }),

  toggleBottomDrawer: () =>
    set((state) => {
      const next = !state.bottomDrawerOpen;
      setStorageValue('bottomDrawerOpen', next);
      return { bottomDrawerOpen: next };
    }),

  setLeftPanelWidth: (width: number) =>
    set(() => {
      const clamped = Math.max(200, Math.min(600, width));
      setStorageValue('leftPanelWidth', clamped);
      return { leftPanelWidth: clamped };
    }),

  setRightPanelWidth: (width: number) =>
    set(() => {
      const clamped = Math.max(240, Math.min(600, width));
      setStorageValue('rightPanelWidth', clamped);
      return { rightPanelWidth: clamped };
    }),

  setBottomDrawerHeight: (height: number) =>
    set(() => {
      const clamped = Math.max(120, Math.min(800, height));
      setStorageValue('bottomDrawerHeight', clamped);
      return { bottomDrawerHeight: clamped };
    }),

  selectedRowIndex: null,

  setSelectedLayerId: (id: string | null) =>
    set(() => ({
      selectedLayerId: id,
    })),

  setSelectedDatasetId: (id: string | null) =>
    set(() => ({
      selectedDatasetId: id,
      // Automatically open bottom drawer if a dataset is selected, to show its table
      bottomDrawerOpen: id !== null ? true : getStorageValue('bottomDrawerOpen', false),
    })),

  setSelectedRowIndex: (index: number | null) =>
    set(() => ({
      selectedRowIndex: index,
    })),

  setCommandPaletteOpen: (open: boolean) =>
    set(() => ({ commandPaletteOpen: open })),

  setRightPanelOpen: (open: boolean) => {
    set(() => {
      setStorageValue('rightPanelOpen', open);
      return { rightPanelOpen: open };
    });
  },
}));
