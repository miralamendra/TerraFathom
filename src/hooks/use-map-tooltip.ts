import { create } from 'zustand';

export interface HoverInfo {
  x: number;
  y: number;
  object?: Record<string, unknown>;
  layer?: {
    id: string;
    props: {
      id: string;
    };
  };
}

interface TooltipState {
  hoverInfo: HoverInfo | null;
  setHoverInfo: (info: HoverInfo | null) => void;
}

export const useMapTooltip = create<TooltipState>((set) => ({
  hoverInfo: null,
  setHoverInfo: (info) => set({ hoverInfo: info }),
}));
export default useMapTooltip;
