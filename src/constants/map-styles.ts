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
  latitude: 40.73061, // NYC coordinates
  longitude: -73.935242,
  zoom: 11,
  pitch: 0,
  bearing: 0,
};
