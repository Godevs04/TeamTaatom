/**
 * Return gradient stop locations only when they match the colors array length.
 * Prevents expo-linear-gradient warning: "colors and locations props should be arrays of the same length".
 */
export function matchGradientLocations(
  colorCount: number,
  preferred: readonly [number, number, ...number[]],
): readonly [number, number, ...number[]] | undefined {
  return colorCount === preferred.length ? preferred : undefined;
}
