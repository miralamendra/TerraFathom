import { MAP_STYLES, type MapStyleOption } from '@/constants/map-styles';

export function getMapStyleById(id: string): MapStyleOption | undefined {
  return MAP_STYLES.find((style) => style.id === id);
}

export function getMapStyleUrl(id: string): string {
  const style = getMapStyleById(id);
  return style?.url ?? MAP_STYLES[0].url;
}

export function isDarkStyle(id: string): boolean {
  return id !== 'positron';
}
