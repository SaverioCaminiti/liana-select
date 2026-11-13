/**
 * Picks black or white text for a background colour, whichever contrasts more,
 * following the WCAG definition of relative luminance.
 *
 * `color` is a computed CSS colour as browsers report it: `rgb()`, `rgba()` or
 * `color(srgb ...)`. Anything else gives white, the usual text colour on an
 * accent colour.
 */
export function contrastingText(color: string): '#000' | '#fff' {
  const channels = parseColor(color);
  if (channels === undefined) return '#fff';
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const withWhite = 1.05 / (luminance + 0.05);
  const withBlack = (luminance + 0.05) / 0.05;
  return withBlack > withWhite ? '#000' : '#fff';
}

/** Red, green and blue between 0 and 1, or `undefined` if the format is unknown. */
function parseColor(color: string): [number, number, number] | undefined {
  const numbers = (text: string): number[] =>
    text
      .split(/[\s,/]+/)
      .filter((part) => part !== '')
      .map(Number);

  const rgb = /^rgba?\(([^)]*)\)$/.exec(color.trim());
  if (rgb?.[1] !== undefined) {
    const [red, green, blue] = numbers(rgb[1]);
    if (red === undefined || green === undefined || blue === undefined) return undefined;
    return [red / 255, green / 255, blue / 255];
  }
  const srgb = /^color\(srgb ([^)]*)\)$/.exec(color.trim());
  if (srgb?.[1] !== undefined) {
    const [red, green, blue] = numbers(srgb[1]);
    if (red === undefined || green === undefined || blue === undefined) return undefined;
    return [red, green, blue];
  }
  return undefined;
}
