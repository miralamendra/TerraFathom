import { create } from 'zustand';
import { DEFAULT_VIEWPORT } from '@/constants/map-styles';
import { clampViewport, type Viewport } from '@/core/map/viewport';

interface MapState {
  latitude: number;
  longitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
  mapStyle: string;
  is3D: boolean;

  setViewport: (viewport: Partial<Viewport>) => void;
  setMapStyle: (styleId: string) => void;
  toggle3D: () => void;
  resetNorth: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  latitude: DEFAULT_VIEWPORT.latitude,
  longitude: DEFAULT_VIEWPORT.longitude,
  zoom: DEFAULT_VIEWPORT.zoom,
  pitch: DEFAULT_VIEWPORT.pitch,
  bearing: DEFAULT_VIEWPORT.bearing,
  mapStyle: 'dark-matter',
  is3D: false,

  setViewport: (vp) =>
    set((state) => {
      const next = clampViewport({
        latitude: vp.latitude ?? state.latitude,
        longitude: vp.longitude ?? state.longitude,
        zoom: vp.zoom ?? state.zoom,
        pitch: vp.pitch ?? state.pitch,
        bearing: vp.bearing ?? state.bearing,
      });
      return next;
    }),

  setMapStyle: (styleId) => set(() => ({ mapStyle: styleId })),

  toggle3D: () =>
    set((state) => {
      const next3D = !state.is3D;
      return {
        is3D: next3D,
        // When entering 3D, set pitch to 45 for better visualization, otherwise reset to 0
        pitch: next3D ? 45 : 0,
      };
    }),

  resetNorth: () => set(() => ({ bearing: 0 })),
}));
