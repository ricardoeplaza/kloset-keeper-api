/**
 * Represents a color category with its coordinates in different spaces.
 */
export interface ColorGroup {
  name: string;
  rgb: [number, number, number];
}

/**
 * Enhanced ColorGroup used during processing to ensure LAB coordinates are present.
 */
interface PreparedColorGroup extends ColorGroup {
  lab: [number, number, number];
}

/**
 * Converts RGB components to a Hexadecimal string.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
    return hex.padStart(2, '0');
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converts RGB color space to CIELAB (L*a*b*).
 * CIELAB is designed to be perceptually uniform, meaning a change of the same 
 * numerical value in these coordinates is perceived by the human eye as a 
 * change of the same visual importance.
 * * Process: RGB -> sRGB Linear -> XYZ -> CIELAB
 */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // 1. Normalize RGB to [0, 1] and apply inverse gamma companding
  let sR = r / 255;
  let sG = g / 255;
  let sB = b / 255;

  const srgbToLinear = (c: number) =>
    c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;

  const rLin = srgbToLinear(sR);
  const gLin = srgbToLinear(sG);
  const bLin = srgbToLinear(sB);

  // 2. Convert to XYZ space using D65 illuminant constants
  const x = rLin * 0.4124 + gLin * 0.3576 + bLin * 0.1805;
  const y = rLin * 0.2126 + gLin * 0.7152 + bLin * 0.0722;
  const z = rLin * 0.0193 + gLin * 0.1192 + bLin * 0.9505;

  // 3. Normalize for D65 white point
  const xr = x / 0.95047;
  const yr = y / 1.00000;
  const zr = z / 1.08883;

  // 4. Transform to L*a*b*
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

  const L = 116 * f(yr) - 16;
  const a = 500 * (f(xr) - f(yr));
  const bVal = 200 * (f(yr) - f(zr));

  return [L, a, bVal];
}

/**
 * Calculates the Euclidean distance between two colors in the CIELAB space.
 * This formula is known as CIE76 or Delta E (ΔE).
 */
export function deltaE(lab1: [number, number, number], lab2: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(lab1[0] - lab2[0], 2) +
    Math.pow(lab1[1] - lab2[1], 2) +
    Math.pow(lab1[2] - lab2[2], 2)
  );
}

/**
 * Pre-calculates LAB coordinates for a set of color groups to optimize performance
 * during batch processing (K-Means/Mapping).
 */
export function prepareColorGroups(groups: ColorGroup[]): PreparedColorGroup[] {
  return groups.map(g => ({
    ...g,
    lab: rgbToLab(g.rgb[0], g.rgb[1], g.rgb[2])
  }));
}

/**
 * Determines the closest commercial color group name for a given RGB color
 * using perceptual distance (Delta E) in the CIELAB space.
 */
export function getClosestGroupName(r: number, g: number, b: number, groups: PreparedColorGroup[]): string {
  if (!groups.length) return 'Unknown';

  const targetLab = rgbToLab(r, g, b);
  let minDistance = Infinity;
  let closestGroup = 'Unknown';

  for (const group of groups) {
    const distance = deltaE(targetLab, group.lab);
    if (distance < minDistance) {
      minDistance = distance;
      closestGroup = group.name;
    }
  }

  return closestGroup;
}