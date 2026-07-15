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

  // Transition params
  transitionDuration: number;

  setViewport: (viewport: Partial<Viewport>) => void;
  animateViewport: (viewport: Partial<Viewport>, duration?: number) => void;
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
  transitionDuration: 0,

  setViewport: (vp) =>
    set((state) => {
      const next = clampViewport({
        latitude: vp.latitude ?? state.latitude,
        longitude: vp.longitude ?? state.longitude,
        zoom: vp.zoom ?? state.zoom,
        pitch: vp.pitch ?? state.pitch,
        bearing: vp.bearing ?? state.bearing,
      });
      return {
        ...next,
        transitionDuration: 0, // Reset to 0 during manual gesture inputs
      };
    }),

  animateViewport: (vp, duration = 1500) =>
    set((state) => {
      const next = clampViewport({
        latitude: vp.latitude ?? state.latitude,
        longitude: vp.longitude ?? state.longitude,
        zoom: vp.zoom ?? state.zoom,
        pitch: vp.pitch ?? state.pitch,
        bearing: vp.bearing ?? state.bearing,
      });
      return {
        ...next,
        transitionDuration: duration,
      };
    }),

  setMapStyle: (styleId) => set(() => ({ mapStyle: styleId })),

  toggle3D: () =>
    set((state) => {
      const next3D = !state.is3D;
      return {
        is3D: next3D,
        pitch: next3D ? 45 : 0,
        bearing: next3D ? 15 : 0,
        transitionDuration: 1500, // Smoothly animate 2D/3D toggle
      };
    }),

  resetNorth: () => set(() => ({ bearing: 0, transitionDuration: 300 })),
}));
export default useMapStore;
