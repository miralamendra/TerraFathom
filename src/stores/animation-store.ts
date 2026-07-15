import { create } from 'zustand';

interface AnimationState {
  isPlaying: boolean;
  currentTime: number;
  timeRange: [number, number] | null;
  timeField: string | null; // Selected column to animate
  speed: number;            // Speed multiplier
  windowSize: number;       // Window size for filtering (0 = cumulative)
  loop: boolean;

  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setTimeRange: (range: [number, number] | null) => void;
  setTimeField: (field: string | null) => void;
  setSpeed: (speed: number) => void;
  setWindowSize: (size: number) => void;
  setLoop: (loop: boolean) => void;
  reset: () => void;
}

export const useAnimationStore = create<AnimationState>((set) => ({
  isPlaying: false,
  currentTime: 0,
  timeRange: null,
  timeField: null,
  speed: 1,
  windowSize: 0,
  loop: true,

  setPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setTimeRange: (timeRange) => set({ timeRange }),
  setTimeField: (timeField) => set({ timeField }),
  setSpeed: (speed) => set({ speed }),
  setWindowSize: (windowSize) => set({ windowSize }),
  setLoop: (loop) => set({ loop }),
  reset: () => set({ isPlaying: false, currentTime: 0, timeRange: null, timeField: null, speed: 1, windowSize: 0 }),
}));
