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

  // New features: drawing selection and AI chat
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

const getWindowWidth35Percent = (): number => {
  const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1400;
  return Math.max(380, Math.min(800, Math.round(winWidth * 0.35)));
};

const initialTab = getStorageValue<'ai' | 'workspace'>('leftPanelActiveTab', 'ai');
const initialLeftWidth = initialTab === 'ai' ? getWindowWidth35Percent() : 340;

export const useUIStore = create<UIState>((set) => ({
  leftPanelOpen: getStorageValue('leftPanelOpen', true),
  rightPanelOpen: getStorageValue('rightPanelOpen', false),
  bottomDrawerOpen: getStorageValue('bottomDrawerOpen', false),
  leftPanelWidth: initialLeftWidth,
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
      const clamped = Math.max(300, Math.min(1000, width));
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

  // Selection & Chat Features
  selectionMode: 'none',
  selectionCoordinates: [],
  geminiApiKey: getInitialApiKey(),
  selectedChatModel: getStorageValue('selectedChatModel', 'mistral-small-latest'),
  chatHistory: [],
  isChatLoading: false,
  isChatOpen: true,
  leftPanelActiveTab: initialTab,

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
  
  // Dynamic Tab Width Switcher: 35% window width for AI Chat tab, default 340px for Workspace tab
  setLeftPanelActiveTab: (tab) => {
    setStorageValue('leftPanelActiveTab', tab);
    set(() => {
      const targetWidth = tab === 'ai' ? getWindowWidth35Percent() : 340;
      setStorageValue('leftPanelWidth', targetWidth);
      return {
        leftPanelActiveTab: tab,
        leftPanelOpen: true,
        leftPanelWidth: targetWidth,
      };
    });
  },
}));
