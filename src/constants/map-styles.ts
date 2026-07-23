export interface MapStyleOption {
  id: string;
  label: string;
  url: string;
}

export const MAP_STYLES: MapStyleOption[] = [
  {
    id: 'dark-matter',
    label: 'Dark Matter (Detailed)',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },
  {
    id: 'dark-matter-nolabels',
    label: 'Dark Matter (No Labels)',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json',
  },
  {
    id: 'dark-matter-alt',
    label: 'Dark Matter (Alt Grid)',
    url: 'https://openmaptiles.github.io/dark-matter-gl-style/style.json',
  },
  {
    id: 'positron',
    label: 'Positron (Light)',
    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  },
];

export const DEFAULT_VIEWPORT = {
  latitude: 6.927079, // Colombo coordinates
  longitude: 79.861244,
  zoom: 12,
  pitch: 0,
  bearing: 0,
};
