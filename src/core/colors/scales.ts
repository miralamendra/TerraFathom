import { type ColorPalette } from './palettes';

export function getLinearScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const denominator = d1 - d0 || 1;
  return (value: number) => {
    const t = Math.max(0, Math.min(1, (value - d0) / denominator));
    return r0 + t * (r1 - r0);
  };
}

export function getSqrtScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const sqrtD0 = Math.sqrt(Math.max(0, d0));
  const sqrtD1 = Math.sqrt(Math.max(0, d1));
  const denominator = sqrtD1 - sqrtD0 || 1;
  return (value: number) => {
    const sqrtVal = Math.sqrt(Math.max(0, value));
    const t = Math.max(0, Math.min(1, (sqrtVal - sqrtD0) / denominator));
    return r0 + t * (r1 - r0);
  };
}

export function getColorScale(
  domain: [number, number],
  palette: ColorPalette,
  scaleType: 'linear' | 'quantize' | 'logarithmic' | 'quantile' | 'ordinal' = 'linear',
  allValues?: number[]
) {
  const [d0, d1] = domain;
  const steps = palette.length;

  if (scaleType === 'logarithmic') {
    // Clamping values to be positive for logarithmic safety
    const minVal = Math.max(0.0001, d0);
    const maxVal = Math.max(minVal * 1.0001, d1);
    const logMin = Math.log(minVal);
    const logMax = Math.log(maxVal);
    const denominator = logMax - logMin;

    return (value: number): [number, number, number] => {
      const clampedVal = Math.max(minVal, value);
      const t = Math.max(0, Math.min(1, (Math.log(clampedVal) - logMin) / denominator));
      return interpolateLinearColor(t, palette);
    };
  } else if (scaleType === 'quantile' && allValues && allValues.length > 0) {
    const sorted = [...allValues].filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b);
    const n = sorted.length;

    return (value: number): [number, number, number] => {
      if (n === 0) return palette[0];
      let idx = sorted.findIndex(v => v >= value);
      if (idx === -1) idx = n - 1;
      const pct = idx / n;
      const paletteIdx = Math.min(steps - 1, Math.floor(pct * steps));
      return palette[paletteIdx];
    };
  } else if (scaleType === 'quantize') {
    const denominator = d1 - d0 || 1;
    return (value: number): [number, number, number] => {
      const t = Math.max(0, Math.min(1, (value - d0) / denominator));
      const idx = Math.min(steps - 1, Math.floor(t * steps));
      return palette[idx];
    };
  } else {
    // 'linear'
    const denominator = d1 - d0 || 1;
    return (value: number): [number, number, number] => {
      const t = Math.max(0, Math.min(1, (value - d0) / denominator));
      return interpolateLinearColor(t, palette);
    };
  }
}

function interpolateLinearColor(t: number, palette: ColorPalette): [number, number, number] {
  const steps = palette.length;
  const rawIdx = t * (steps - 1);
  const idx = Math.floor(rawIdx);
  const nextIdx = Math.min(steps - 1, idx + 1);
  const frac = rawIdx - idx;

  const c1 = palette[idx];
  const c2 = palette[nextIdx];

  return [
    Math.round(c1[0] + frac * (c2[0] - c1[0])),
    Math.round(c1[1] + frac * (c2[1] - c1[1])),
    Math.round(c1[2] + frac * (c2[2] - c1[2])),
  ];
}

export function getOrdinalScale(
  domain: (string | number | boolean | null)[],
  palette: ColorPalette
) {
  const valueMap = new Map<string | number | boolean | null, number>();
  domain.forEach((val, idx) => valueMap.set(val, idx));
  const len = palette.length;

  return (value: string | number | boolean | null): [number, number, number] => {
    const idx = valueMap.get(value);
    if (idx === undefined) {
      return [120, 120, 120]; // Gray fallback
    }
    return palette[idx % len];
  };
}
