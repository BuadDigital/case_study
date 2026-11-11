/**
 * A map pin drawn as a circle with a symbol inside (Omar 2026-11-11: the subject property is a
 * circle carrying a house, not a letter). Pure — the picture is an SVG the map shows as an image.
 */

export type MapPinSymbol = "home";

/** Inner markup on a 24×24 grid, stroked — the same house as the «لوحة التحكم» nav icon. */
const SYMBOL_MARKUP: Record<MapPinSymbol, string> = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
};

/** Width and height of the picture in pixels; the pin's centre is the middle of it. */
export const MAP_PIN_SYMBOL_SIZE = 30;
const FALLBACK_COLOR = "#378add";

/**
 * The picture of a symbol pin: a filled circle with a white edge and the symbol in white.
 *
 * Edge cases: a colour that is not a plain hex value falls back to the map's default blue, so
 * nothing but a colour ever reaches the markup.
 */
export function mapPinSymbolSvg(symbol: MapPinSymbol, color: string): string {
  const fill = /^#[0-9a-f]{3,8}$/i.test(color) ? color : FALLBACK_COLOR;
  const size = MAP_PIN_SYMBOL_SIZE;
  const half = size / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${half}" cy="${half}" r="${half - 2.5}" fill="${fill}" stroke="#fff" stroke-width="3"/>` +
    `<g transform="translate(8 7.4) scale(0.58)" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">` +
    SYMBOL_MARKUP[symbol] +
    `</g></svg>`
  );
}

/** The same picture as an image address a map marker takes. */
export function mapPinSymbolUrl(symbol: MapPinSymbol, color: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(mapPinSymbolSvg(symbol, color))}`;
}
