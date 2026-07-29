/**
 * Perceptual colour distance, for keeping gameplay-critical things legible.
 *
 * A pickup the player cannot pick out of the ground is a gameplay bug wearing an
 * art costume — 영기 used to be jade green lying on a jade green plateau. Stages
 * ship their own palettes, so "does this read?" has to be a number that a test
 * can check against every stage rather than something judged once by eye on one
 * of them.
 *
 * CIE76 over Lab is plenty here. It is crude next to CIEDE2000, but it is a few
 * lines with no tuning constants, and the failures it misses are not the ones
 * that matter at this scale — we are separating a saturated gem from a large
 * flat field, not matching print colours.
 */

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Hex to CIE Lab, D65. */
export function labOf(hex) {
  const r = srgbToLinear(((hex >> 16) & 255) / 255)
  const g = srgbToLinear(((hex >> 8) & 255) / 255)
  const b = srgbToLinear((hex & 255) / 255)

  // Linear sRGB to XYZ, then normalise by the D65 white point.
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.9505
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.089

  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** CIE76 ΔE. Roughly: under 10 is "same colour at a glance", over 40 is obvious. */
export function deltaE(a, b) {
  const [l1, a1, b1] = labOf(a)
  const [l2, a2, b2] = labOf(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

/** Worst-case separation of `hex` against a set of background colours. */
export function minDeltaE(hex, backgrounds) {
  let worst = Infinity
  for (const bg of backgrounds) worst = Math.min(worst, deltaE(hex, bg))
  return worst
}
