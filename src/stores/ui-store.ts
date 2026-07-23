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

  // Features: drawing selection and AI chat
  selectionMode: 'none' | 'point' | 'rectangle' | 'freehand';
  selectionCoordinates: [number, number][];
  geminiApiKey: string;
  selectedChatModel: string;
  chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[];
  isChatLoading: boolean;
  isChatOpen: boolean;
  leftPanelActiveTab: 'ai' | 'workspace';

  setSelectionMode: (mode: 'none' | 'point' | 'rectangle' | 'freehand') => void;
  setSelectionCoordinates: (coords: [number, number][]) => void;
  setGeminiApiKey: (key: string) => void;
  setSelectedChatModel: (model: string) => void;
  addChatMessage: (role: 'user' | 'model', text: string) => void;
  clearChatHistory: () => void;
  setChatLoading: (loading: boolean) => void;
  toggleChat: () => void;
  setLeftPanelActiveTab: (tab: 'ai' | 'workspace') => void;
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

const getInitialApiKey = (): string => {
  const storedKey = getStorageValue<string>('geminiApiKey', '');
  const envApiKey = import.meta.env.VITE_GEMINI_API_KEY ?? '';
  return storedKey || envApiKey || 'Cvl015afU0purMg6UPY9P7KKrHCppJnA';
};

const getWindowWidth30Percent = (): number => {
  const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1400;
  return Math.max(340, Math.min(500, Math.round(winWidth * 0.30)));
};

export const useUIStore = create<UIState>((set) => ({
  leftPanelOpen: true, // ALWAYS default unfolded on load, unaffected by stale localStorage
  rightPanelOpen: false,
  bottomDrawerOpen: false, // Data table drawer ALWAYS closed by default on page load
  leftPanelWidth: getWindowWidth30Percent(), // Crisp proportional sidebar width
  rightPanelWidth: 320,
  bottomDrawerHeight: 240,
  selectedLayerId: null,
  selectedDatasetId: null,
  commandPaletteOpen: false,

  toggleLeftPanel: () =>
    set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),

  toggleRightPanel: () =>
    set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

  toggleBottomDrawer: () =>
    set((state) => ({ bottomDrawerOpen: !state.bottomDrawerOpen })),

  setLeftPanelWidth: (width: number) =>
    set(() => {
      const clamped = Math.max(300, Math.min(700, width));
      setStorageValue('leftPanelWidth', clamped);
      return { leftPanelWidth: clamped };
    }),

  setRightPanelWidth: (width: number) =>
    set(() => {
      const clamped = Math.max(240, Math.min(500, width));
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
      // Do not force open the bottom drawer on dataset load
    })),

  setSelectedRowIndex: (index: number | null) =>
    set(() => ({
      selectedRowIndex: index,
    })),

  setCommandPaletteOpen: (open: boolean) =>
    set(() => ({ commandPaletteOpen: open })),

  setRightPanelOpen: (open: boolean) => {
    set(() => ({ rightPanelOpen: open }));
  },

  // Selection & Chat Features
  selectionMode: 'none',
  selectionCoordinates: [],
  geminiApiKey: getInitialApiKey(),
  selectedChatModel: getStorageValue('selectedChatModel', 'mistral-small-latest'),
  chatHistory: [],
  isChatLoading: false,
  isChatOpen: true,
  leftPanelActiveTab: 'ai', // ALWAYS default to AI Assistant tab on startup

  setSelectionMode: (mode) => set(() => ({ selectionMode: mode })),
  setSelectionCoordinates: (coords) => set(() => ({ selectionCoordinates: coords })),
  setGeminiApiKey: (key) => {
    setStorageValue('geminiApiKey', key);
    set(() => ({ geminiApiKey: key }));
  },
  setSelectedChatModel: (model) => {
    setStorageValue('selectedChatModel', model);
    set(() => ({ selectedChatModel: model }));
  },
  addChatMessage: (role, text) => set((state) => ({
    chatHistory: [...state.chatHistory, { role, parts: [{ text }] }]
  })),
  clearChatHistory: () => set(() => ({ chatHistory: [] })),
  setChatLoading: (loading) => set(() => ({ isChatLoading: loading })),
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  
  // Tab Switcher: Maintains identical sleek sidebar width for both Workspace and AI tabs
  setLeftPanelActiveTab: (tab) => {
    set(() => {
      const targetWidth = getWindowWidth30Percent();
      return {
        leftPanelActiveTab: tab,
        leftPanelOpen: true,
        leftPanelWidth: targetWidth,
      };
    });
  },
}));
