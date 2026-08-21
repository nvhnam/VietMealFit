/**
 * Geometry for deciding whether a pie slice's label can sit inside the slice.
 *
 * Kept apart from the chart component so it can be tested directly: the vitest
 * suite runs in a node environment over `tests/**\/*.test.ts`, with no React or
 * SVG renderer in play.
 */

/** Fraction of a wedge's width to actually fill, so text keeps a little air. */
const INSIDE_LABEL_FIT = 0.86;

/**
 * Rough advance width for the UI sans at a given size. Deliberately an estimate
 * rather than a DOM measurement: this only has to decide "does this name fit in
 * this wedge", and measuring would force a layout on every re-render.
 * Vietnamese diacritics ride above their base letter, so they add no width.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.58;
}

/**
 * True when a label of `textWidth` px fits inside a wedge covering `share` of
 * the circle, when drawn at `labelRadius` from the centre.
 *
 * A fixed percentage threshold would be the wrong rule, because whether a label
 * fits depends on the label: at a realistic 11% fat slice "Fat" fits with room
 * to spare while "Chất béo" does not. Comparing the text against the chord
 * width at the label's own radius makes the call per language instead of
 * silently clipping Vietnamese.
 */
export function fitsInsideWedge(
  share: number,
  labelRadius: number,
  textWidth: number,
): boolean {
  if (!(share > 0) || !(labelRadius > 0)) return false;
  const angle = Math.min(share, 1) * 2 * Math.PI;
  // Past a half turn the chord starts shrinking again even though the wedge is
  // only getting bigger, so anything that wide is always roomy enough.
  if (angle >= Math.PI) return true;
  return textWidth <= 2 * labelRadius * Math.sin(angle / 2) * INSIDE_LABEL_FIT;
}
