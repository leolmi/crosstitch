/**
 * Conversioni colorimetriche e distanza percettiva CIEDE2000.
 * Riferimenti: sRGB IEC 61966-2-1 (D65), G. Sharma et al., "The CIEDE2000
 * Color-Difference Formula: Implementation Notes, ...", 2005.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Lab {
  l: number;
  a: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) {
    throw new Error(`Colore hex non valido: '${hex}'`);
  }
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

/** Converte un colore sRGB (0-255 per canale) in CIELAB con bianco D65. */
export function rgbToLab({ r, g, b }: Rgb): Lab {
  const linear = (channel: number): number => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const rl = linear(r);
  const gl = linear(g);
  const bl = linear(b);

  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  const z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041;

  // Bianco di riferimento D65
  const xn = 0.95047;
  const yn = 1;
  const zn = 1.08883;
  const f = (t: number): number =>
    t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
  const fx = f(x / xn);
  const fy = f(y / yn);
  const fz = f(z / zn);

  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const POW25_7 = Math.pow(25, 7);

/** Distanza percettiva CIEDE2000 tra due colori Lab. */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const { l: l1, a: a1, b: b1 } = lab1;
  const { l: l2, a: a2, b: b2 } = lab2;

  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cMean = (c1 + c2) / 2;
  const g =
    0.5 *
    (1 - Math.sqrt(Math.pow(cMean, 7) / (Math.pow(cMean, 7) + POW25_7)));

  const a1p = a1 * (1 + g);
  const a2p = a2 * (1 + g);
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const h1p = c1p === 0 ? 0 : (Math.atan2(b1, a1p) * DEG + 360) % 360;
  const h2p = c2p === 0 ? 0 : (Math.atan2(b2, a2p) * DEG + 360) % 360;

  const dLp = l2 - l1;
  const dCp = c2p - c1p;

  let dhp: number;
  if (c1p * c2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhp / 2) * RAD);

  const lpMean = (l1 + l2) / 2;
  const cpMean = (c1p + c2p) / 2;

  let hpMean: number;
  if (c1p * c2p === 0) {
    hpMean = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hpMean = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hpMean = (h1p + h2p + 360) / 2;
  } else {
    hpMean = (h1p + h2p - 360) / 2;
  }

  const t =
    1 -
    0.17 * Math.cos((hpMean - 30) * RAD) +
    0.24 * Math.cos(2 * hpMean * RAD) +
    0.32 * Math.cos((3 * hpMean + 6) * RAD) -
    0.2 * Math.cos((4 * hpMean - 63) * RAD);
  const dTheta = 30 * Math.exp(-Math.pow((hpMean - 275) / 25, 2));
  const rc =
    2 * Math.sqrt(Math.pow(cpMean, 7) / (Math.pow(cpMean, 7) + POW25_7));
  const sl =
    1 +
    (0.015 * Math.pow(lpMean - 50, 2)) /
      Math.sqrt(20 + Math.pow(lpMean - 50, 2));
  const sc = 1 + 0.045 * cpMean;
  const sh = 1 + 0.015 * cpMean * t;
  const rt = -Math.sin(2 * dTheta * RAD) * rc;

  return Math.sqrt(
    Math.pow(dLp / sl, 2) +
      Math.pow(dCp / sc, 2) +
      Math.pow(dHp / sh, 2) +
      rt * (dCp / sc) * (dHp / sh),
  );
}
