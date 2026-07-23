export type ColorPalette = [number, number, number][];

export interface PaletteOption {
  id: string;
  name: string;
  type: 'sequential' | 'diverging' | 'qualitative';
  colors: ColorPalette;
}

export const COLOR_PALETTES: PaletteOption[] = [
  {
    id: 'space-syntax',
    name: 'Space Syntax Classic (Blue -> Red)',
    type: 'sequential',
    colors: [
      [44, 123, 182],  // Deep Indigo/Blue (Low metric / Bottom 50%)
      [171, 217, 233], // Cyan / Light Blue (Low-Mid)
      [255, 255, 191], // Soft Yellow (Medium)
      [253, 174, 97],  // Bright Orange (High-Mid)
      [215, 25, 28],   // Deep Red / Crimson (High Metric / Top 10%)
    ],
  },
  // SEQUENTIAL
  {
    id: 'curated',
    name: 'GeoFathom Curated',
    type: 'sequential',
    colors: [
      [15, 17, 23],    // Deep map matching slate-black
      [36, 68, 122],   // Muted steel blue
      [104, 127, 168], // Cool steel silver
      [206, 155, 96],  // Muted amber
      [242, 230, 213], // Soft warm white-hot
    ],
  },
  {
    id: 'cividis',
    name: 'Cividis',
    type: 'sequential',
    colors: [
      [0, 32, 76],
      [65, 90, 140],
      [120, 143, 168],
      [180, 197, 164],
      [250, 250, 110],
    ],
  },
  {
    id: 'turbo',
    name: 'Turbo',
    type: 'sequential',
    colors: [
      [48, 18, 59],
      [70, 107, 227],
      [40, 188, 235],
      [50, 242, 152],
      [164, 252, 60],
      [238, 172, 40],
      [234, 51, 35],
    ],
  },
  {
    id: 'viridis',
    name: 'Viridis',
    type: 'sequential',
    colors: [
      [68, 1, 84],
      [59, 82, 139],
      [33, 145, 140],
      [94, 201, 98],
      [253, 231, 37],
    ],
  },
  {
    id: 'plasma',
    name: 'Plasma',
    type: 'sequential',
    colors: [
      [13, 8, 135],
      [126, 3, 168],
      [204, 71, 120],
      [248, 149, 64],
      [240, 249, 33],
    ],
  },
  {
    id: 'magma',
    name: 'Magma',
    type: 'sequential',
    colors: [
      [11, 4, 5],
      [81, 18, 124],
      [182, 54, 121],
      [251, 136, 97],
      [252, 253, 191],
    ],
  },
  {
    id: 'inferno',
    name: 'Inferno',
    type: 'sequential',
    colors: [
      [0, 0, 4],
      [87, 16, 110],
      [187, 55, 84],
      [249, 142, 9],
      [252, 253, 191],
    ],
  },
  {
    id: 'density',
    name: 'Density (Teal-Blue)',
    type: 'sequential',
    colors: [
      [237, 248, 251],
      [178, 226, 226],
      [102, 194, 164],
      [44, 162, 95],
      [0, 109, 44],
    ],
  },
  {
    id: 'warmth',
    name: 'Warmth (Yellow-Red)',
    type: 'sequential',
    colors: [
      [254, 240, 217],
      [253, 204, 138],
      [252, 141, 89],
      [227, 74, 51],
      [179, 0, 0],
    ],
  },
  {
    id: 'cool',
    name: 'Cool (Purple-Blue)',
    type: 'sequential',
    colors: [
      [242, 240, 247],
      [203, 201, 226],
      [158, 154, 200],
      [117, 107, 177],
      [84, 39, 143],
    ],
  },

  // SINGLE COLOR RANGES (SEQUENTIAL)
  {
    id: 'red-ramp',
    name: 'Red Range',
    type: 'sequential',
    colors: [
      [40, 10, 10],
      [90, 20, 20],
      [150, 40, 40],
      [210, 80, 80],
      [255, 150, 150],
    ],
  },
  {
    id: 'blue-ramp',
    name: 'Blue Range',
    type: 'sequential',
    colors: [
      [10, 20, 50],
      [25, 50, 110],
      [50, 100, 190],
      [100, 160, 245],
      [190, 225, 255],
    ],
  },
  {
    id: 'green-ramp',
    name: 'Green Range',
    type: 'sequential',
    colors: [
      [10, 35, 20],
      [25, 75, 45],
      [50, 130, 80],
      [100, 200, 140],
      [180, 245, 210],
    ],
  },
  {
    id: 'orange-ramp',
    name: 'Orange Range',
    type: 'sequential',
    colors: [
      [40, 20, 5],
      [95, 45, 10],
      [165, 85, 20],
      [235, 140, 50],
      [255, 210, 150],
    ],
  },
  {
    id: 'purple-ramp',
    name: 'Purple Range',
    type: 'sequential',
    colors: [
      [30, 10, 45],
      [70, 25, 105],
      [120, 55, 175],
      [175, 110, 235],
      [230, 185, 255],
    ],
  },
  {
    id: 'gray-ramp',
    name: 'Gray Range',
    type: 'sequential',
    colors: [
      [20, 20, 25],
      [50, 50, 55],
      [100, 100, 105],
      [160, 160, 165],
      [220, 220, 225],
    ],
  },

  // DIVERGING
  {
    id: 'spectral',
    name: 'Spectral',
    type: 'diverging',
    colors: [
      [213, 62, 79],
      [252, 141, 89],
      [254, 224, 139],
      [230, 245, 152],
      [153, 213, 148],
      [50, 136, 189],
    ],
  },
  {
    id: 'rdylgn',
    name: 'Red to Green',
    type: 'diverging',
    colors: [
      [215, 48, 39],
      [252, 141, 89],
      [254, 224, 139],
      [217, 239, 139],
      [145, 207, 96],
      [26, 152, 80],
    ],
  },
  {
    id: 'redBlue',
    name: 'Red to Blue',
    type: 'diverging',
    colors: [
      [202, 0, 32],
      [244, 165, 130],
      [247, 247, 247],
      [146, 197, 222],
      [5, 113, 176],
    ],
  },
  {
    id: 'warmCool',
    name: 'Warm to Cool (Orange-Teal)',
    type: 'diverging',
    colors: [
      [230, 97, 1],
      [253, 184, 99],
      [247, 247, 247],
      [178, 223, 138],
      [31, 120, 180],
    ],
  },

  // QUALITATIVE
  {
    id: 'bold',
    name: 'Bold (Qualitative)',
    type: 'qualitative',
    colors: [
      [228, 26, 28],
      [55, 126, 184],
      [77, 175, 74],
      [152, 78, 163],
      [255, 127, 0],
      [255, 255, 51],
      [166, 86, 40],
      [247, 129, 191],
    ],
  },
  {
    id: 'muted',
    name: 'Muted (Qualitative)',
    type: 'qualitative',
    colors: [
      [251, 180, 174],
      [179, 205, 227],
      [204, 235, 197],
      [222, 203, 228],
      [254, 217, 166],
      [255, 255, 204],
      [229, 216, 189],
      [233, 233, 233],
    ],
  },
];

export function getPalette(id?: string): PaletteOption {
  return COLOR_PALETTES.find((p) => p.id === id) || COLOR_PALETTES[0];
}
